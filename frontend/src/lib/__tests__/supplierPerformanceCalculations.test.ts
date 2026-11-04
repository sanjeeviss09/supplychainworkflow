import { describe, it, expect } from 'vitest';
import {
  calculateDeliveryMetrics,
  differenceInCalendarDays,
  getTodayISTDate,
} from '../deliveryCalculations';

describe('Supplier Performance & Delivery Delay Calculations', () => {
  it('correctly calculates difference in calendar days across weekends and months', () => {
    // 2026-11-10 to 2026-11-15 (5 calendar days, crossing a weekend)
    expect(differenceInCalendarDays('2026-11-10', '2026-11-15')).toBe(5);
    // Across month boundary
    expect(differenceInCalendarDays('2026-10-28', '2026-11-03')).toBe(6);
    // Same day is 0
    expect(differenceInCalendarDays('2026-11-10', '2026-11-10')).toBe(0);
    // Prior date is negative
    expect(differenceInCalendarDays('2026-11-15', '2026-11-10')).toBe(-5);
  });

  it('evaluates on-time status when due date itself is reached (Day 0 = 0 delay days)', () => {
    const res = calculateDeliveryMetrics({
      orderedQuantity: 100,
      deliveredQuantity: 0,
      originalCommittedDeliveryDate: '2026-11-10',
      currentExpectedDeliveryDate: '2026-11-10',
      referenceDateIST: '2026-11-10', // Due date itself
    });

    expect(res.totalDeliveryDelayDays).toBe(0);
    expect(res.currentOverdueDays).toBe(0);
    expect(res.isOverdue).toBe(false);
    expect(res.calculatedStatus).toBe('SCHEDULED');
  });

  it('evaluates 1 calendar day of delay on the first overdue day (Day 1)', () => {
    const res = calculateDeliveryMetrics({
      orderedQuantity: 100,
      deliveredQuantity: 0,
      originalCommittedDeliveryDate: '2026-11-10',
      currentExpectedDeliveryDate: '2026-11-10',
      referenceDateIST: '2026-11-11', // Next day
    });

    expect(res.totalDeliveryDelayDays).toBe(1);
    expect(res.currentOverdueDays).toBe(1);
    expect(res.isOverdue).toBe(true);
    expect(res.calculatedStatus).toBe('DELAYED');
    expect(res.delayCategory).toBe('1_TO_3');
  });

  it('freezes final delay when fully delivered after original commitment date', () => {
    // Committed: 10 Nov, Fully delivered: 13 Nov, Current check date: 15 Nov
    const res = calculateDeliveryMetrics({
      orderedQuantity: 500,
      deliveredQuantity: 500,
      originalCommittedDeliveryDate: '2026-11-10',
      actualCompletionDate: '2026-11-13',
      referenceDateIST: '2026-11-15',
    });

    // Final delay must be exactly 3 days (13 Nov - 10 Nov), NOT 5 days (15 Nov - 10 Nov)
    expect(res.totalDeliveryDelayDays).toBe(3);
    expect(res.currentOverdueDays).toBe(0);
    expect(res.calculatedStatus).toBe('DELIVERED');
    expect(res.deliveryPercentage).toBe(100);
    expect(res.isOverdue).toBe(false);
  });

  it('marks line on-time if fully delivered on or before original commitment date', () => {
    // Committed: 10 Nov, Fully delivered: 08 Nov
    const res = calculateDeliveryMetrics({
      orderedQuantity: 200,
      deliveredQuantity: 200,
      originalCommittedDeliveryDate: '2026-11-10',
      actualCompletionDate: '2026-11-08',
      referenceDateIST: '2026-11-15',
    });

    expect(res.totalDeliveryDelayDays).toBe(0);
    expect(res.calculatedStatus).toBe('DELIVERED');
    expect(res.isOverdue).toBe(false);
  });

  it('continues accruing delay for partial deliveries while balance remains', () => {
    // Committed: 10 Nov, Partial: 250/500 arrived on 12 Nov, Current date: 15 Nov
    const res = calculateDeliveryMetrics({
      orderedQuantity: 500,
      deliveredQuantity: 250,
      originalCommittedDeliveryDate: '2026-11-10',
      currentExpectedDeliveryDate: '2026-11-14',
      referenceDateIST: '2026-11-15',
    });

    // Accrues delay against referenceDateIST (15 Nov - 10 Nov = 5 days)
    expect(res.outstandingQuantity).toBe(250);
    expect(res.deliveryPercentage).toBe(50);
    expect(res.totalDeliveryDelayDays).toBe(5);
    expect(res.currentOverdueDays).toBe(1); // 15 Nov - 14 Nov = 1 day overdue against current ETA
    expect(res.calculatedStatus).toBe('DELAYED');
    expect(res.isOverdue).toBe(true);
  });

  it('revised ETA does NOT reset or reduce original-commitment delay', () => {
    // Original committed: 10 Nov. Supplier pushed ETA to 20 Nov. Today is 15 Nov.
    const res = calculateDeliveryMetrics({
      orderedQuantity: 1000,
      deliveredQuantity: 0,
      originalCommittedDeliveryDate: '2026-11-10',
      currentExpectedDeliveryDate: '2026-11-20', // Future revised ETA!
      referenceDateIST: '2026-11-15',
    });

    // Original delay is 5 days (15 Nov - 10 Nov)
    expect(res.totalDeliveryDelayDays).toBe(5);
    // Current ETA overdue is 0 because 20 Nov is in the future
    expect(res.currentOverdueDays).toBe(0);
    // Must still be flagged as delayed because the original commitment was missed!
    expect(res.calculatedStatus).toBe('DELAYED');
    expect(res.isOverdue).toBe(true);
  });

  it('flags missing original commitment date as Not Calculable without substituting revised ETA', () => {
    const res = calculateDeliveryMetrics({
      orderedQuantity: 300,
      deliveredQuantity: 0,
      originalCommittedDeliveryDate: null, // MISSING
      currentExpectedDeliveryDate: '2026-11-12',
      referenceDateIST: '2026-11-15',
    });

    expect(res.isCalculable).toBe(false);
    expect(res.totalDeliveryDelayDays).toBeNull(); // NOT CALCULABLE
    expect(res.currentOverdueDays).toBe(3); // 15 Nov - 12 Nov
    expect(res.delayCategory).toBe('NOT_CALCULABLE');
  });

  it('resets metrics to 0 and marks status CANCELLED when tracking record is cancelled', () => {
    const res = calculateDeliveryMetrics({
      orderedQuantity: 100,
      deliveredQuantity: 0,
      originalCommittedDeliveryDate: '2026-11-01',
      isCancelled: true,
      referenceDateIST: '2026-11-15',
    });

    expect(res.calculatedStatus).toBe('CANCELLED');
    expect(res.totalDeliveryDelayDays).toBe(0);
    expect(res.currentOverdueDays).toBe(0);
    expect(res.isOverdue).toBe(false);
  });
});

