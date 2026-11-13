/**
 * Theme decision logic test for Quetzaly.
 * Verifies resolveTheme() and IndexedDB settings persistence with fake-indexeddb.
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDB, getStoredSettings, saveStoredSettings } from '../src/lib/db';
import { resolveTheme } from '../src/lib/theme';

async function clearSettingsStore() {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function run() {
  console.log('=== QUETZALY THEME DECISION TEST ===\n');

  // 1. No saved preference + light device setting -> dark
  await clearSettingsStore();
  const emptySettings = await getStoredSettings();
  const emptyResolvedWithLightDevice = resolveTheme(emptySettings.themeMode, false);
  const undefinedResolvedWithLightDevice = resolveTheme(undefined, false);
  assert.equal(emptyResolvedWithLightDevice, 'dark', 'Empty DB with light OS must resolve to dark');
  assert.equal(undefinedResolvedWithLightDevice, 'dark', 'Undefined preference with light OS must resolve to dark');
  console.log(
    `1. No saved preference + light device setting: db.themeMode="${emptySettings.themeMode}", resolved="${emptyResolvedWithLightDevice}", undefined="${undefinedResolvedWithLightDevice}" -> PASSED`
  );

  // 2. Saved "light" -> stays light (even if device is dark)
  await saveStoredSettings({ themeMode: 'light' });
  const lightSettings = await getStoredSettings();
  const lightResolved = resolveTheme(lightSettings.themeMode, true);
  assert.equal(lightSettings.themeMode, 'light');
  assert.equal(lightResolved, 'light', 'Saved light preference must stay light');
  console.log(`2. Saved "light" + dark device setting: resolved="${lightResolved}" -> PASSED`);

  // 3. Saved "dark" -> stays dark (even if device is light)
  await saveStoredSettings({ themeMode: 'dark' });
  const darkSettings = await getStoredSettings();
  const darkResolved = resolveTheme(darkSettings.themeMode, false);
  assert.equal(darkSettings.themeMode, 'dark');
  assert.equal(darkResolved, 'dark', 'Saved dark preference must stay dark');
  console.log(`3. Saved "dark" + light device setting: resolved="${darkResolved}" -> PASSED`);

  // 4. Saved "follow device" ('system') + light device setting -> light
  await saveStoredSettings({ themeMode: 'system' });
  const systemSettings = await getStoredSettings();
  const systemLightResolved = resolveTheme(systemSettings.themeMode, false);
  const systemDarkResolved = resolveTheme(systemSettings.themeMode, true);
  assert.equal(systemSettings.themeMode, 'system');
  assert.equal(systemLightResolved, 'light', 'Saved system preference with light device must resolve to light');
  assert.equal(systemDarkResolved, 'dark', 'Saved system preference with dark device must resolve to dark');
  console.log(
    `4. Saved "system" (follow device): light device -> "${systemLightResolved}", dark device -> "${systemDarkResolved}" -> PASSED`
  );

  // 5. Verify index.html and manifest.webmanifest dark pre-paint attributes
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/manifest.webmanifest'), 'utf8')
  );
  assert.ok(indexHtml.includes('<html lang="en" class="dark">'), 'index.html must start with class="dark"');
  assert.ok(
    indexHtml.includes('<meta name="color-scheme" content="dark light" />'),
    'index.html must include color-scheme meta'
  );
  assert.ok(
    indexHtml.includes('<meta name="theme-color" content="#0E0F0D" />'),
    'index.html theme-color must be #0E0F0D'
  );
  assert.ok(indexHtml.includes('#0E0F0D'), 'index.html critical CSS must set #0E0F0D');
  assert.equal(manifest.background_color, '#0E0F0D');
  assert.equal(manifest.theme_color, '#0E0F0D');
  console.log('5. index.html & manifest.webmanifest dark pre-paint checks -> PASSED\n');

  console.log('=== ALL THEME TESTS PASSED ===');
}

run().catch((err) => {
  console.error('THEME TEST FAILED:', err?.message || err);
  process.exit(1);
});
