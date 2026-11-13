# Quetzaly

A personal budgeting app for people who spend in more than one currency and budget on their own cycle, not the calendar month.

Quetzaly runs in the browser, keeps all data on your device, and needs no account or API key.

## Why this exists

My own budget runs on cycles that start on the 22nd, my home currency is the Mexican peso, and I sometimes spend in Guatemalan quetzales or euros. Most budgeting apps assume one currency and a calendar month, so I built one that does not. The name comes from the quetzal, Guatemala's currency.

## Features

**Fast logging.** Type the amount on a calculator-style keypad, then tap a category to save. Optional note, date and receipt photo, with an Undo toast. The keyboard works on desktop.

**Multiple currencies.** A searchable picker with 166 currencies and a home currency set in Settings. Each entry stores its exchange rate and whether the rate was fetched, estimated, pending or edited by hand.

**Budget cycles.** The cycle can start on any day. The home screen shows what is left to spend and a daily allowance, with optional rollover and limits for the whole budget or single categories.

**Insights.** A plain-language sentence about the cycle, a daily spending chart, an earned-versus-spent comparison across cycles and a category breakdown.

**Recurring entries.** Weekly, every-two-weeks, monthly and yearly rules. Due items appear on Home with Add and Skip, or post automatically when the rule says so. Days 29 to 31 fall on the last day of shorter months.

**Backup.** Export everything to one JSON file and import it back with Merge or Replace. An import either completes fully or changes nothing, and Merge is blocked when the backup's home currency differs from the device's.

**Themes.** Dark by default, with a light option, and English (US) formatting throughout.

## Built with

React, TypeScript and Tailwind CSS, with IndexedDB for on-device storage. Exchange rates come from Frankfurter first, with ExchangeRate-API as a keyless fallback for currencies the first source lacks, such as GTQ.

The code was generated with Gemini's app builder under my direction. I wrote the specifications, designed the screens, checked every change in the running app and ran the tests below.

## Design decisions

Money is stored as whole cents to avoid rounding errors. Each entry keeps its own exchange rate, so old entries do not change when rates move. Rate services are keyless, because a browser app cannot keep a secret key. Every recurring occurrence is recorded as posted or skipped, so none can appear twice. Imports run in one transaction, so a failed import leaves existing data untouched.

## Run it locally

Run npm install, then npm run dev.

## Checks

Run npm run lint, then any script in the scripts folder with npx tsx, for example npx tsx scripts/test-roundtrip.ts. The scripts cover the backup round trip, recurring schedules, the full backup, the welcome sheet, theme logic and the home-screen daily average and allowance.

## Roadmap

Offline use and installing as an app (the files are in place; being tested on the live site), custom date ranges with saved favourites, and a "Needs attention" card with customisable Insights.

## Credits

Exchange rates by Frankfurter and ExchangeRate-API. Built as a project for the Handshake AI Skills course.

## Licence

MIT. See LICENSE.
