/**
 * Verification suite for:
 * 1. Shared currency formatting rule (omit .00 on whole amounts, preserve fractional precision, keep FX rates 4 decimals)
 * 2. Daily spending chart axis label layout (first day, last day, near endpoints, middle, past cycle) at mobile (360px viewport -> 328px chart) and desktop (640px) widths
 */
import assert from 'node:assert/strict';
import {
  formatCents,
  formatCodeAmount,
  formatExchangeRate,
  decimalStringToCents,
  centsToDecimalString,
} from '../src/lib/currency';
import {
  computeDailyChartLabelsLayout,
  estimateAxisLabelWidthPx,
} from '../src/lib/chartLabels';

function runCurrencyFormatterTests() {
  console.log('1. Testing shared currency formatting rule...');

  // Exact examples from specification
  assert.equal(formatCodeAmount(1650000, 'MXN'), 'MXN 16,500');
  assert.equal(formatCodeAmount(126000, 'MXN', { showSign: true }), '+MXN 1,260');
  assert.equal(formatCodeAmount(0, 'MXN'), 'MXN 0');
  assert.equal(formatCents(53226, 'MXN'), 'MX$532.26');
  assert.equal(formatCodeAmount(1850, 'GBP'), 'GBP 18.50');
  assert.equal(formatCodeAmount(5, 'GBP'), 'GBP 0.05');

  // Additional consistency checks across formatCents and formatCodeAmount
  assert.equal(formatCents(1650000, 'MXN'), 'MX$16,500');
  assert.equal(formatCents(126000, 'MXN', { showSign: true }), '+MX$1,260');
  assert.equal(formatCents(0, 'MXN'), 'MX$0');
  assert.equal(formatCents(1850, 'GBP'), '£18.50');
  assert.equal(formatCents(1800, 'GBP'), '£18');
  assert.equal(formatCents(5, 'GBP'), '£0.05');
  assert.equal(formatCents(100000, 'USD'), '$1,000');
  assert.equal(formatCents(100050, 'USD'), '$1,000.50');

  // Negative whole & fractional amounts
  assert.equal(formatCodeAmount(-45000, 'MXN'), '-MXN 450');
  assert.equal(formatCodeAmount(-1850, 'GBP'), '-GBP 18.50');
  assert.equal(formatCents(-45000, 'MXN'), '-MX$450');
  assert.equal(formatCents(-1850, 'GBP'), '-£18.50');

  // Zero-decimal currency (JPY): stored directly in yen minor units
  assert.equal(formatCents(1500, 'JPY'), '¥1,500');
  assert.equal(formatCodeAmount(1500, 'JPY'), 'JPY 1,500');

  // Non-USD/symbolless currency (GTQ)
  const gtqWhole = formatCents(40000, 'GTQ').replace(/\u00a0/g, ' ');
  assert.equal(gtqWhole, 'GTQ 400');
  assert.equal(formatCents(40025, 'GTQ').replace(/\u00a0/g, ' '), 'GTQ 400.25');
  assert.equal(formatCodeAmount(40000, 'GTQ'), 'GTQ 400');

  // Exchange rates keep their own 4-decimal precision
  assert.equal(formatExchangeRate(0.04), '0.0400');
  assert.equal(formatExchangeRate(25), '25.0000');
  assert.equal(formatExchangeRate(20.85), '20.8500');

  // Stored cents conversion & input decimal serialization remain unchanged
  assert.equal(decimalStringToCents('450'), 45000);
  assert.equal(decimalStringToCents('18.50'), 1850);
  assert.equal(centsToDecimalString(45000, 2), '450.00');
  assert.equal(centsToDecimalString(1850, 2), '18.50');

  console.log('   - Currency formatter tests PASSED.');
}

function assertTodayInsideBounds(
  layout: ReturnType<typeof computeDailyChartLabelsLayout>,
  containerWidthPx: number,
  scenario: string
) {
  const todayW = estimateAxisLabelWidthPx(layout.todayText, true);
  assert.ok(layout.todayLeftPx >= 0, `${scenario}: Today left (${layout.todayLeftPx}) must be >= 0`);
  assert.ok(
    layout.todayLeftPx + todayW <= containerWidthPx,
    `${scenario}: Today right (${layout.todayLeftPx + todayW}) must be <= ${containerWidthPx}`
  );
}

function runChartLabelTests() {
  console.log('2. Testing Daily spending chart axis label layout...');

  const mobileWidth = 328; // 360px mobile viewport minus 32px main horizontal padding
  const desktopWidth = 640; // max-w-2xl (672px) minus 32px padding
  const totalDays = 31; // Oct 22 - Nov 21
  const startLabel = 'Oct 22';
  const endLabel = 'Nov 21';

  for (const width of [mobileWidth, desktopWidth]) {
    const labelMode = width === mobileWidth ? 'mobile 360px' : 'desktop 640px';

    // Case A: Today falls on the FIRST day of the cycle (todayIndex = 0)
    const firstDay = computeDailyChartLabelsLayout({
      totalDays,
      todayIndex: 0,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      containerWidthPx: width,
    });
    assert.equal(firstDay.showToday, false, `${labelMode} first day: standalone Today hidden`);
    assert.equal(firstDay.showStart, true, `${labelMode} first day: combined start visible`);
    assert.equal(firstDay.startIsTodayCombined, true);
    assert.equal(firstDay.startText, 'Today · Oct 22');
    assert.equal(firstDay.showEnd, true, `${labelMode} first day: end date visible with room`);
    assert.equal(firstDay.endText, 'Nov 21');

    // Case B: Today falls on the LAST day of the cycle (todayIndex = 30)
    const lastDay = computeDailyChartLabelsLayout({
      totalDays,
      todayIndex: totalDays - 1,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      containerWidthPx: width,
    });
    assert.equal(lastDay.showToday, false, `${labelMode} last day: standalone Today hidden`);
    assert.equal(lastDay.showEnd, true, `${labelMode} last day: combined end visible`);
    assert.equal(lastDay.endIsTodayCombined, true);
    assert.equal(lastDay.endText, 'Today · Nov 21');
    assert.equal(lastDay.showStart, true, `${labelMode} last day: start date visible with room`);
    assert.equal(lastDay.startText, 'Oct 22');

    // Case C: Today is ONE DAY BEFORE THE END (todayIndex = 29)
    const oneBeforeEnd = computeDailyChartLabelsLayout({
      totalDays,
      todayIndex: totalDays - 2,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      containerWidthPx: width,
    });
    assert.equal(oneBeforeEnd.showToday, true, `${labelMode} day before end: Today visible`);
    assert.equal(oneBeforeEnd.showStart, true, `${labelMode} day before end: start visible`);
    assert.equal(oneBeforeEnd.showEnd, false, `${labelMode} day before end: overlapping end label hidden`);
    assertTodayInsideBounds(oneBeforeEnd, width, `${labelMode} day before end`);

    // Case D: Today is ONE DAY AFTER THE START (todayIndex = 1)
    const oneAfterStart = computeDailyChartLabelsLayout({
      totalDays,
      todayIndex: 1,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      containerWidthPx: width,
    });
    assert.equal(oneAfterStart.showToday, true, `${labelMode} day after start: Today visible`);
    assert.equal(oneAfterStart.showStart, false, `${labelMode} day after start: overlapping start label hidden`);
    assert.equal(oneAfterStart.showEnd, true, `${labelMode} day after start: end visible`);
    assertTodayInsideBounds(oneAfterStart, width, `${labelMode} day after start`);

    // Case E: Today is in the MIDDLE of the cycle (todayIndex = 15)
    const midCycle = computeDailyChartLabelsLayout({
      totalDays,
      todayIndex: 15,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      containerWidthPx: width,
    });
    assert.equal(midCycle.showStart, true);
    assert.equal(midCycle.showToday, true);
    assert.equal(midCycle.showEnd, true);
    assertTodayInsideBounds(midCycle, width, `${labelMode} mid-cycle`);

    // Case F: Past/future cycle (todayIndex = -1)
    const pastCycle = computeDailyChartLabelsLayout({
      totalDays,
      todayIndex: -1,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      containerWidthPx: width,
    });
    assert.equal(pastCycle.showStart, true);
    assert.equal(pastCycle.showEnd, true);
    assert.equal(pastCycle.showToday, false);
  }

  // Case G: Near-end where desktop has room for both labels, but 360px mobile hides end label (todayIndex = 27)
  const day28Mobile = computeDailyChartLabelsLayout({
    totalDays,
    todayIndex: 27,
    startDateLabel: startLabel,
    endDateLabel: endLabel,
    containerWidthPx: mobileWidth,
  });
  const day28Desktop = computeDailyChartLabelsLayout({
    totalDays,
    todayIndex: 27,
    startDateLabel: startLabel,
    endDateLabel: endLabel,
    containerWidthPx: desktopWidth,
  });
  assert.equal(day28Mobile.showToday, true);
  assert.equal(day28Mobile.showEnd, false, '360px mobile hides Nov 21 when Today would crowd/overlap it');
  assert.equal(day28Desktop.showToday, true);
  assert.equal(day28Desktop.showEnd, true, '640px desktop keeps both Today and Nov 21 when there is room');

  console.log('   - Chart axis label tests PASSED for mobile (360px) and desktop (640px).');
}

runCurrencyFormatterTests();
runChartLabelTests();
console.log('\n=== ALL DISPLAY FIX TESTS PASSED ===');
