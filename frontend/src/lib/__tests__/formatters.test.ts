import { describe, it, expect } from 'vitest';
import { formatINR, formatQuantity, formatDateIST, isDeliveryDueIn3Days } from '../formatters';

describe('SCM Flow Standard Formatters', () => {
  it('formats currency correctly in Indian Rupee format (₹ #,##,###.##)', () => {
    // 12,50,000 INR
    const formatted = formatINR(1250000);
    expect(formatted).toContain('12,50,000.00');

    // 0 INR
    expect(formatINR(0)).toContain('0.00');
    expect(formatINR(null)).toBe('₹ 0.00');
    expect(formatINR(undefined)).toBe('₹ 0.00');
  });

  it('formats quantities with exact 3-decimal precision and UOM', () => {
    expect(formatQuantity(1250.5, 'KG')).toBe('1,250.500 KG');
    expect(formatQuantity(0, 'LITRE')).toBe('0.000 LITRE');
    expect(formatQuantity(null, 'KG')).toBe('0.000 KG');
  });

  it('formats dates in Asia/Kolkata timezone (DD MMM YYYY)', () => {
    const dateStr = '2026-11-03T12:00:00Z';
    const formatted = formatDateIST(dateStr);
    expect(formatted).toContain('Nov');
    expect(formatted).toContain('2026');
  });

  it('correctly detects delivery due within 3 calendar days', () => {
    const today = new Date();
    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);

    const inTenDays = new Date(today);
    inTenDays.setDate(today.getDate() + 10);

    expect(isDeliveryDueIn3Days(inTwoDays.toISOString())).toBe(true);
    expect(isDeliveryDueIn3Days(inTenDays.toISOString())).toBe(false);
  });
});

