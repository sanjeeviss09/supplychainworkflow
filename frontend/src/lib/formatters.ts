/**
 * SCM Flow Standard Localized Formatters
 * Enforces confirmed configuration decisions:
 * - Base Currency: Indian Rupee (INR / ₹) with Indian numbering format
 * - Default Timezone: Asia/Kolkata (IST)
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_CURRENCY = 'INR';

/**
 * Formats a numeric value into the Indian Rupee system: ₹ #,##,###.##
 * Example: 1250000 -> "₹ 12,50,000.00"
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹ 0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a decimal quantity with 3-decimal precision and UOM
 * Example: formatQuantity(1250.5, 'KG') -> "1,250.500 KG"
 */
export function formatQuantity(quantity: number | null | undefined, uom: string = ''): string {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return `0.000 ${uom}`.trim();
  }

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(quantity);

  return uom ? `${formatted} ${uom}` : formatted;
}

/**
 * Formats a Date or ISO string into IST standard display: DD MMM YYYY
 * Example: "2026-11-17" -> "17 Nov 2026"
 */
export function formatDateIST(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Checks if a promised delivery date is within the critical 3-day reminder threshold
 */
export function isDeliveryDueIn3Days(promisedDateInput: string | Date): boolean {
  if (!promisedDateInput) return false;
  const promised = typeof promisedDateInput === 'string' ? new Date(promisedDateInput) : promisedDateInput;
  const now = new Date();

  // Difference in calendar days
  const diffTime = promised.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= 3;
}

