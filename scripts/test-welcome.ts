/**
 * Proof test script for Welcome sheet settings preservation and defaults.
 * Runs against fake-indexeddb using real src/lib/db.ts and src/lib/welcomeLogic.ts.
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getStoredSettings, saveStoredSettings } from '../src/lib/db';
import {
  getWelcomeInitialValues,
  buildWelcomeGetStartedUpdates,
  applyWelcomeSkip,
  applyWelcomeGetStarted,
} from '../src/lib/welcomeLogic';
import { WelcomeModal } from '../src/components/WelcomeModal';

async function clearSettingsStore() {
  const { getDB } = await import('../src/lib/db');
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function run() {
  console.log('=== QUETZALY WELCOME SHEET SETTINGS PROOF TEST ===\n');

  // (a) Seed settings of MXN, cycle day 22, rollover off
  await clearSettingsStore();
  await saveStoredSettings({
    homeCurrency: 'MXN',
    monthStartDay: 22,
    rolloverEnabled: false,
    hasSeenWelcome: false,
  });

  const seeded = await getStoredSettings();
  const prefillSeeded = getWelcomeInitialValues(seeded, true);
  const renderedSeededHtml = renderToStaticMarkup(
    React.createElement(WelcomeModal, {
      isOpen: true,
      onClose: () => {},
      onGetStarted: () => {},
      currentSettings: seeded,
      isSettingsLoaded: true,
    })
  );

  assert.equal(prefillSeeded.homeCurrency, 'MXN');
  assert.equal(prefillSeeded.monthStartDay, 22);
  assert.ok(renderedSeededHtml.includes('(MXN)'), 'Welcome sheet HTML should display MXN');
  assert.ok(renderedSeededHtml.includes('Starts on the 22nd'), 'Welcome sheet HTML should display 22nd');

  console.log('(a) SEEDED EXISTING SETTINGS (MXN, day 22, rollover off):');
  console.log(`    - Prefilled values: currency=${prefillSeeded.homeCurrency}, monthStartDay=${prefillSeeded.monthStartDay}`);

  // Run Skip path
  await applyWelcomeSkip({
    isSettingsLoaded: true,
    saveSettings: saveStoredSettings,
  });
  const afterSkip = await getStoredSettings();
  assert.equal(afterSkip.homeCurrency, 'MXN');
  assert.equal(afterSkip.monthStartDay, 22);
  assert.equal(afterSkip.rolloverEnabled, false);
  assert.equal(afterSkip.hasSeenWelcome, true);
  console.log(
    `    - After Skip: currency=${afterSkip.homeCurrency}, monthStartDay=${afterSkip.monthStartDay}, rolloverEnabled=${afterSkip.rolloverEnabled}, hasSeenWelcome=${afterSkip.hasSeenWelcome} -> UNCHANGED`
  );

  // Run Get started path WITHOUT edits
  const noEditUpdates = buildWelcomeGetStartedUpdates({
    initialCurrency: prefillSeeded.homeCurrency,
    initialStartDay: prefillSeeded.monthStartDay,
    selectedCurrency: 'MXN',
    selectedStartDay: 22,
    hasEditedCurrency: false,
    hasEditedStartDay: false,
  });
  assert.deepEqual(noEditUpdates, { hasSeenWelcome: true });

  const getStartedNoEditResult = await applyWelcomeGetStarted({
    isSettingsLoaded: true,
    currentSettings: afterSkip,
    updates: noEditUpdates,
    saveSettings: saveStoredSettings,
  });
  assert.equal(getStartedNoEditResult.currencyChanged, false);
  assert.equal(getStartedNoEditResult.dayChanged, false);

  const afterNoEditGetStarted = await getStoredSettings();
  assert.equal(afterNoEditGetStarted.homeCurrency, 'MXN');
  assert.equal(afterNoEditGetStarted.monthStartDay, 22);
  assert.equal(afterNoEditGetStarted.rolloverEnabled, false);
  assert.equal(afterNoEditGetStarted.hasSeenWelcome, true);
  console.log(
    `    - After Get started (no edits): currency=${afterNoEditGetStarted.homeCurrency}, monthStartDay=${afterNoEditGetStarted.monthStartDay}, rolloverEnabled=${afterNoEditGetStarted.rolloverEnabled}, hasSeenWelcome=${afterNoEditGetStarted.hasSeenWelcome} -> UNCHANGED\n`
  );

  // (b) Truly empty database defaults to USD and day 1
  await clearSettingsStore();
  const emptySettings = await getStoredSettings();
  const prefillEmpty = getWelcomeInitialValues(emptySettings, true);
  const renderedEmptyHtml = renderToStaticMarkup(
    React.createElement(WelcomeModal, {
      isOpen: true,
      onClose: () => {},
      onGetStarted: () => {},
      currentSettings: emptySettings,
      isSettingsLoaded: true,
    })
  );

  assert.equal(prefillEmpty.homeCurrency, 'USD');
  assert.equal(prefillEmpty.monthStartDay, 1);
  assert.ok(renderedEmptyHtml.includes('(USD)'), 'Empty launch Welcome sheet should display USD');
  assert.ok(renderedEmptyHtml.includes('Starts on the 1st'), 'Empty launch Welcome sheet should display 1st');
  console.log('(b) TRULY EMPTY DATABASE:');
  console.log(
    `    - Defaults: currency=${prefillEmpty.homeCurrency}, monthStartDay=${prefillEmpty.monthStartDay} -> VERIFIED\n`
  );

  // (c) Changing values in the sheet and pressing "Get started" saves them
  await clearSettingsStore();
  await saveStoredSettings({
    homeCurrency: 'MXN',
    monthStartDay: 22,
    rolloverEnabled: false,
    hasSeenWelcome: false,
  });
  const beforeEdit = await getStoredSettings();
  const editedUpdates = buildWelcomeGetStartedUpdates({
    initialCurrency: beforeEdit.homeCurrency,
    initialStartDay: beforeEdit.monthStartDay,
    selectedCurrency: 'EUR',
    selectedStartDay: 15,
    hasEditedCurrency: true,
    hasEditedStartDay: true,
  });
  assert.deepEqual(editedUpdates, {
    hasSeenWelcome: true,
    homeCurrency: 'EUR',
    monthStartDay: 15,
  });

  const getStartedEditedResult = await applyWelcomeGetStarted({
    isSettingsLoaded: true,
    currentSettings: beforeEdit,
    updates: editedUpdates,
    saveSettings: saveStoredSettings,
  });
  assert.equal(getStartedEditedResult.currencyChanged, true);
  assert.equal(getStartedEditedResult.dayChanged, true);

  const afterEditedGetStarted = await getStoredSettings();
  assert.equal(afterEditedGetStarted.homeCurrency, 'EUR');
  assert.equal(afterEditedGetStarted.monthStartDay, 15);
  assert.equal(afterEditedGetStarted.rolloverEnabled, false);
  assert.equal(afterEditedGetStarted.hasSeenWelcome, true);
  console.log('(c) CHANGING VALUES AND PRESSING GET STARTED:');
  console.log(
    `    - Updated: currency=${afterEditedGetStarted.homeCurrency}, monthStartDay=${afterEditedGetStarted.monthStartDay}, rolloverEnabled=${afterEditedGetStarted.rolloverEnabled}, hasSeenWelcome=${afterEditedGetStarted.hasSeenWelcome} -> SAVED\n`
  );

  // (d) Guard check: while isSettingsLoaded=false ("not loaded yet"), Skip and Get started never write
  await saveStoredSettings({
    homeCurrency: 'MXN',
    monthStartDay: 22,
    rolloverEnabled: false,
    hasSeenWelcome: false,
  });
  let writeCountWhileNotLoaded = 0;
  const spySave = async (u: any) => {
    writeCountWhileNotLoaded++;
    return saveStoredSettings(u);
  };
  await applyWelcomeSkip({ isSettingsLoaded: false, saveSettings: spySave });
  await applyWelcomeGetStarted({
    isSettingsLoaded: false,
    currentSettings: beforeEdit,
    updates: { homeCurrency: 'USD', monthStartDay: 1 },
    saveSettings: spySave,
  });
  assert.equal(writeCountWhileNotLoaded, 0);
  const afterNotLoaded = await getStoredSettings();
  assert.equal(afterNotLoaded.homeCurrency, 'MXN');
  assert.equal(afterNotLoaded.monthStartDay, 22);
  console.log('(d) NOT-LOADED-YET GUARD:');
  console.log(
    `    - Storage writes when isSettingsLoaded=false: ${writeCountWhileNotLoaded}, stored values remain ${afterNotLoaded.homeCurrency} day ${afterNotLoaded.monthStartDay} -> VERIFIED\n`
  );

  console.log('=== ALL WELCOME PROOF ASSERTIONS PASSED ===');
}

run().catch((err) => {
  console.error('Welcome proof test failed:', err);
  process.exit(1);
});
