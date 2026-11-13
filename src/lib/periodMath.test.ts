/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPeriodForAnchor, getPeriodForDate, getDaysInMonth, formatDateKey } from './periodMath';

export function runPeriodMathTests() {
  const results: { name: string; passed: boolean; details?: string }[] = [];

  // Test 1: Start day 31 across full year 2026 (non-leap year)
  {
    const startDay = 31;
    let noGapsOrOverlaps = true;

    for (let m = 0; m < 11; m++) {
      const pCurrent = getPeriodForAnchor(2026, m, startDay);
      const pNext = getPeriodForAnchor(2026, m + 1, startDay);

      // pCurrent.endDate must be exactly 1 day before pNext.startDate
      const [curEndY, curEndM, curEndD] = pCurrent.endDate.split('-').map(Number);
      const curEndDate = new Date(curEndY, curEndM - 1, curEndD);
      const nextDay = new Date(curEndDate.getTime() + 24 * 60 * 60 * 1000);
      const nextDayKey = formatDateKey(nextDay);

      if (nextDayKey !== pNext.startDate) {
        noGapsOrOverlaps = false;
        results.push({
          name: `Start day 31 gap/overlap between month ${m} and ${m + 1}`,
          passed: false,
          details: `pCurrent end: ${pCurrent.endDate}, pNext start: ${pNext.startDate}, expected: ${nextDayKey}`,
        });
        break;
      }
    }

    if (noGapsOrOverlaps) {
      results.push({
        name: 'Start day 31 consecutive boundaries (zero gaps, zero overlaps across all months)',
        passed: true,
      });
    }
  }

  // Test 2: Specific checks for start day 31 clamping
  {
    // Jan 2026 anchor with startDay = 31: starts 2026-01-31, ends 2026-02-27 (Feb 2026 has 28 days)
    const jan31Period = getPeriodForAnchor(2026, 0, 31);
    const feb31Period = getPeriodForAnchor(2026, 1, 31);

    const passed =
      jan31Period.startDate === '2026-01-31' &&
      jan31Period.endDate === '2026-02-27' &&
      feb31Period.startDate === '2026-02-28' &&
      feb31Period.endDate === '2026-03-30';

    results.push({
      name: 'Start day 31 February clamping exact dates',
      passed,
      details: `Jan: ${jan31Period.startDate} to ${jan31Period.endDate}; Feb: ${feb31Period.startDate} to ${feb31Period.endDate}`,
    });
  }

  // Test 3: Default start day 22
  {
    const oct22Period = getPeriodForAnchor(2026, 9, 22);
    const passed = oct22Period.startDate === '2026-10-22' && oct22Period.endDate === '2026-11-21';
    results.push({
      name: 'Default start day 22 (Oct 22 to Nov 21)',
      passed,
      details: `${oct22Period.startDate} to ${oct22Period.endDate}`,
    });
  }

  // Test 4: Start day 1 (calendar months)
  {
    const nov1Period = getPeriodForAnchor(2026, 10, 1);
    const passed = nov1Period.startDate === '2026-11-01' && nov1Period.endDate === '2026-11-30';
    results.push({
      name: 'Start day 1 (Nov 1 to Nov 30)',
      passed,
      details: `${nov1Period.startDate} to ${nov1Period.endDate}`,
    });
  }

  return results;
}
