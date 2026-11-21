/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DailyChartLabelsLayout {
  showStart: boolean;
  startText: string;
  startIsTodayCombined: boolean;
  showEnd: boolean;
  endText: string;
  endIsTodayCombined: boolean;
  showToday: boolean;
  todayText: string;
  todayLeftPx: number;
  todayCenterPct: number;
}

const MIN_LABEL_GAP_PX = 8;

/**
 * Conservative glyph width estimate for 11px medium/semibold axis labels
 * so collision detection stays deterministic in unit tests as well as DOM layouts.
 */
export function estimateAxisLabelWidthPx(text: string, isBold: boolean = false): number {
  const perChar = isBold ? 6.8 : 6.4;
  return Math.ceil(text.length * perChar) + 4;
}

/**
 * Computes responsive, non-overlapping x-axis label visibility and placement for Daily spending:
 * - First day (`todayIndex === 0`): combined "Today · <start>" at left edge.
 * - Last day (`todayIndex === totalDays - 1`): combined "Today · <end>" at right edge.
 * - Intermediate days: keeps "Today" aligned over its bar (clamped inside chart width)
 *   and hides a nearby endpoint label only when the two boxes would overlap.
 */
export function computeDailyChartLabelsLayout(params: {
  totalDays: number;
  todayIndex: number;
  startDateLabel: string;
  endDateLabel: string;
  containerWidthPx: number;
  startLabelWidthPx?: number;
  endLabelWidthPx?: number;
  todayLabelWidthPx?: number;
}): DailyChartLabelsLayout {
  const {
    totalDays,
    todayIndex,
    startDateLabel,
    endDateLabel,
    containerWidthPx,
  } = params;

  if (totalDays <= 0) {
    return {
      showStart: false,
      startText: '',
      startIsTodayCombined: false,
      showEnd: false,
      endText: '',
      endIsTodayCombined: false,
      showToday: false,
      todayText: 'Today',
      todayLeftPx: 0,
      todayCenterPct: 50,
    };
  }

  const width = Math.max(120, containerWidthPx);
  const startW = params.startLabelWidthPx ?? estimateAxisLabelWidthPx(startDateLabel, false);
  const endW = params.endLabelWidthPx ?? estimateAxisLabelWidthPx(endDateLabel, false);
  const todayW = params.todayLabelWidthPx ?? estimateAxisLabelWidthPx('Today', true);

  // Case 1: Today falls on the first day of the cycle
  if (todayIndex === 0) {
    const combinedStart = `Today · ${startDateLabel}`;
    const combinedW = estimateAxisLabelWidthPx(combinedStart, true);
    const showEnd = totalDays > 1 && combinedW + MIN_LABEL_GAP_PX + endW <= width;

    return {
      showStart: true,
      startText: combinedStart,
      startIsTodayCombined: true,
      showEnd,
      endText: endDateLabel,
      endIsTodayCombined: false,
      showToday: false,
      todayText: 'Today',
      todayLeftPx: 0,
      todayCenterPct: (0.5 / totalDays) * 100,
    };
  }

  // Case 2: Today falls on the last day of the cycle
  if (todayIndex === totalDays - 1 && totalDays > 1) {
    const combinedEnd = `Today · ${endDateLabel}`;
    const combinedW = estimateAxisLabelWidthPx(combinedEnd, true);
    const showStart = startW + MIN_LABEL_GAP_PX + combinedW <= width;

    return {
      showStart,
      startText: startDateLabel,
      startIsTodayCombined: false,
      showEnd: true,
      endText: combinedEnd,
      endIsTodayCombined: true,
      showToday: false,
      todayText: 'Today',
      todayLeftPx: Math.max(0, width - combinedW),
      todayCenterPct: ((totalDays - 0.5) / totalDays) * 100,
    };
  }

  // Case 3: Past/future cycle (today not in active range)
  if (todayIndex < 0 || todayIndex >= totalDays) {
    return {
      showStart: true,
      startText: startDateLabel,
      startIsTodayCombined: false,
      showEnd: totalDays > 1,
      endText: endDateLabel,
      endIsTodayCombined: false,
      showToday: false,
      todayText: 'Today',
      todayLeftPx: 0,
      todayCenterPct: 50,
    };
  }

  // Case 4: Today is strictly inside the cycle (0 < todayIndex < totalDays - 1)
  const todayCenterPct = ((todayIndex + 0.5) / totalDays) * 100;
  const barCenterPx = (todayCenterPct / 100) * width;
  const maxTodayLeft = Math.max(0, width - todayW);
  const todayLeftPx = Math.max(0, Math.min(maxTodayLeft, barCenterPx - todayW / 2));
  const todayRightPx = todayLeftPx + todayW;

  const overlapsStart = todayLeftPx < startW + MIN_LABEL_GAP_PX;
  const overlapsEnd = todayRightPx > width - endW - MIN_LABEL_GAP_PX;

  return {
    showStart: !overlapsStart,
    startText: startDateLabel,
    startIsTodayCombined: false,
    showEnd: !overlapsEnd && totalDays > 1,
    endText: endDateLabel,
    endIsTodayCombined: false,
    showToday: true,
    todayText: 'Today',
    todayLeftPx,
    todayCenterPct,
  };
}
