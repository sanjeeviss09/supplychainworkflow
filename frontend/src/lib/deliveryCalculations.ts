import { DeliveryTrackingStatus } from '@/types/database.types';

/**
 * Returns today's date formatted as YYYY-MM-DD in the Asia/Kolkata (IST) timezone.
 */
export function getTodayISTDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Parses a YYYY-MM-DD date string into UTC midnight timestamp for exact calendar-day differences.
 */
function parseDateToMidnightUTC(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Calculates calendar day difference (dateB - dateA).
 * Positive means dateB is after dateA.
 */
export function differenceInCalendarDays(dateStrA: string, dateStrB: string): number {
  const msA = parseDateToMidnightUTC(dateStrA);
  const msB = parseDateToMidnightUTC(dateStrB);
  const diffMs = msB - msA;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export interface DelayMetricsResult {
  outstandingQuantity: number;
  deliveryPercentage: number;
  currentOverdueDays: number;
  totalDeliveryDelayDays: number | null; // Null if missing original commitment date (Not Calculable)
  isCalculable: boolean;
  calculatedStatus: DeliveryTrackingStatus;
  isOverdue: boolean;
  delayCategory: 'NONE' | '1_TO_3' | '4_TO_7' | '8_TO_15' | '16_TO_30' | 'OVER_30' | 'NOT_CALCULABLE';
}

/**
 * Authoritative delivery and delay metrics calculation for a PO line tracking record.
 * Uses calendar days in Asia/Kolkata (IST).
 * Delay is strictly evaluated against the original committed delivery date.
 * If original commitment date is missing, delay is flagged as Not Calculable.
 */
export function calculateDeliveryMetrics(params: {
  orderedQuantity: number;
  deliveredQuantity: number;
  originalCommittedDeliveryDate?: string | null;
  currentExpectedDeliveryDate?: string | null;
  actualCompletionDate?: string | null;
  isCancelled?: boolean;
  referenceDateIST?: string;
}): DelayMetricsResult {
  const {
    orderedQuantity,
    deliveredQuantity,
    originalCommittedDeliveryDate,
    currentExpectedDeliveryDate,
    actualCompletionDate,
    isCancelled = false,
    referenceDateIST = getTodayISTDate(),
  } = params;

  const outstandingQuantity = Math.max(0, orderedQuantity - deliveredQuantity);
  const deliveryPercentage =
    orderedQuantity > 0
      ? Math.min(100, Math.round((deliveredQuantity / orderedQuantity) * 10000) / 100)
      : 0;

  if (isCancelled) {
    return {
      outstandingQuantity,
      deliveryPercentage,
      currentOverdueDays: 0,
      totalDeliveryDelayDays: 0,
      isCalculable: Boolean(originalCommittedDeliveryDate),
      calculatedStatus: 'CANCELLED',
      isOverdue: false,
      delayCategory: 'NONE',
    };
  }

  const isFullDelivery = deliveredQuantity >= orderedQuantity && orderedQuantity > 0;

  // 1. Current Overdue Days (against latest revised expected date)
  let currentOverdueDays = 0;
  if (!isFullDelivery && currentExpectedDeliveryDate) {
    const daysPastExpected = differenceInCalendarDays(currentExpectedDeliveryDate, referenceDateIST);
    currentOverdueDays = Math.max(0, daysPastExpected);
  }

  // 2. Original Commitment Delay Days (strictly against first supplier-confirmed original commitment)
  let totalDeliveryDelayDays: number | null = null;
  const isCalculable = Boolean(originalCommittedDeliveryDate && originalCommittedDeliveryDate.trim());

  if (isCalculable && originalCommittedDeliveryDate) {
    if (isFullDelivery && actualCompletionDate) {
      const daysPastCommitment = differenceInCalendarDays(originalCommittedDeliveryDate, actualCompletionDate);
      totalDeliveryDelayDays = Math.max(0, daysPastCommitment);
    } else if (!isFullDelivery) {
      const daysPastCommitment = differenceInCalendarDays(originalCommittedDeliveryDate, referenceDateIST);
      totalDeliveryDelayDays = Math.max(0, daysPastCommitment);
    }
  }

  // 3. Status Determination
  let calculatedStatus: DeliveryTrackingStatus = 'AWAITING_SCHEDULE';

  if (isFullDelivery) {
    calculatedStatus = 'DELIVERED';
  } else if (!currentExpectedDeliveryDate && !originalCommittedDeliveryDate) {
    calculatedStatus = 'AWAITING_SCHEDULE';
  } else if ((totalDeliveryDelayDays !== null && totalDeliveryDelayDays > 0) || currentOverdueDays > 0) {
    calculatedStatus = 'DELAYED';
  } else if (deliveredQuantity > 0) {
    calculatedStatus = 'PARTIALLY_DELIVERED';
  } else {
    calculatedStatus = 'SCHEDULED';
  }

  const isOverdue =
    !isFullDelivery &&
    ((totalDeliveryDelayDays !== null && totalDeliveryDelayDays > 0) || currentOverdueDays > 0);

  // 4. Delay Category Breakdown (1-3, 4-7, 8-15, 16-30, >30 days)
  let delayCategory: 'NONE' | '1_TO_3' | '4_TO_7' | '8_TO_15' | '16_TO_30' | 'OVER_30' | 'NOT_CALCULABLE' = 'NONE';

  if (!isCalculable && isOverdue) {
    delayCategory = 'NOT_CALCULABLE';
  } else {
    const effectiveDelay = Math.max(currentOverdueDays, totalDeliveryDelayDays || 0);

    if (effectiveDelay >= 1 && effectiveDelay <= 3) {
      delayCategory = '1_TO_3';
    } else if (effectiveDelay >= 4 && effectiveDelay <= 7) {
      delayCategory = '4_TO_7';
    } else if (effectiveDelay >= 8 && effectiveDelay <= 15) {
      delayCategory = '8_TO_15';
    } else if (effectiveDelay >= 16 && effectiveDelay <= 30) {
      delayCategory = '16_TO_30';
    } else if (effectiveDelay > 30) {
      delayCategory = 'OVER_30';
    }
  }

  return {
    outstandingQuantity,
    deliveryPercentage,
    currentOverdueDays,
    totalDeliveryDelayDays,
    isCalculable,
    calculatedStatus,
    isOverdue,
    delayCategory,
  };
}

