import { describe, it, expect } from 'vitest';
import { calculateSupplyRiskScore } from '../supplyRiskService';

describe('Phase 11: Supply Risk Scoring Engine', () => {
  const mockToday = '2026-11-04';

  it('calculates baseline score for Low Criticality and Low Impact without breaches', () => {
    const result = calculateSupplyRiskScore(
      'Low',
      'Low',
      '2026-11-30',
      '2026-11-20',
      '2026-11-20',
      0,
      100,
      false,
      mockToday
    );

    expect(result.score).toBe(5);
    expect(result.level).toBe('Low');
    expect(result.factors).toEqual(['Material Criticality is Low (+5)']);
  });

  it('adds +35 for Critical material and +30 for Critical business impact', () => {
    const result = calculateSupplyRiskScore(
      'Critical',
      'Critical',
      '2026-11-30',
      '2026-11-20',
      '2026-11-20',
      0,
      100,
      false,
      mockToday
    );

    // 35 (Critical material) + 30 (Critical impact) = 65 (High risk)
    expect(result.score).toBe(65);
    expect(result.level).toBe('High');
    expect(result.factors).toContain('Material Criticality is Critical (+35)');
    expect(result.factors).toContain('Operational Business Impact is Critical (+30)');
  });

  it('triggers +30 breach when Current Expected Delivery Date > Internal Required-By Date', () => {
    const result = calculateSupplyRiskScore(
      'Critical',
      'Critical',
      '2026-11-10', // Required by Nov 10
      '2026-11-15', // Expected Nov 15 (5 days late!)
      '2026-11-10',
      0,
      100,
      false,
      mockToday
    );

    // 35 + 30 + 30 = 95 (Critical risk >= 70)
    expect(result.score).toBe(95);
    expect(result.level).toBe('Critical');
    expect(result.factors.some((f) => f.includes('breaches Required-by Date'))).toBe(true);
  });

  it('triggers +15 when Required-by Date is within 3 days and balance is outstanding', () => {
    const result = calculateSupplyRiskScore(
      'Medium', // 15
      'Medium', // 10
      '2026-11-06', // 2 days from Nov 04 (+15)
      '2026-11-05',
      '2026-11-06',
      0,
      100,
      false,
      mockToday
    );

    // 15 + 10 + 15 = 40 (Medium risk)
    expect(result.score).toBe(40);
    expect(result.level).toBe('Medium');
    expect(result.factors).toContain('Required-by Date approaching within 3 calendar days (+15)');
  });

  it('triggers +20 when past original commitment date with undelivered balance', () => {
    const result = calculateSupplyRiskScore(
      'Medium', // 15
      'Low', // 0
      '2026-11-20',
      '2026-11-15',
      '2026-11-01', // Past Nov 04 (+20)
      0,
      50,
      false,
      mockToday
    );

    // 15 + 20 = 35 (Medium risk)
    expect(result.score).toBe(35);
    expect(result.level).toBe('Medium');
    expect(result.factors).toContain('Past Original Confirmed Commitment (+20)');
  });

  it('triggers +10 for partial delivery with remaining balance', () => {
    const result = calculateSupplyRiskScore(
      'High', // 25
      'Low', // 0
      '2026-11-30',
      '2026-11-25',
      '2026-11-25',
      40, // 40 delivered out of 100 (+10)
      100,
      false,
      mockToday
    );

    // 25 + 10 = 35 (Medium risk)
    expect(result.score).toBe(35);
    expect(result.level).toBe('Medium');
    expect(result.factors).toContain('Partial Delivery arrived with balance outstanding (+10)');
  });

  it('triggers +25 when an active Phase 9 Critical Issue exists', () => {
    const result = calculateSupplyRiskScore(
      'High', // 25
      'High', // 20
      '2026-11-30',
      '2026-11-25',
      '2026-11-25',
      0,
      100,
      true, // Active critical issue (+25)
      mockToday
    );

    // 25 + 20 + 25 = 70 (Critical risk >= 70)
    expect(result.score).toBe(70);
    expect(result.level).toBe('Critical');
    expect(result.factors).toContain('Active Phase 9 Critical/High Delivery Issue/Escalation (+25)');
  });

  it('correctly maps all 4 risk thresholds', () => {
    // Score < 25 -> Low
    const low = calculateSupplyRiskScore('Low', 'Low', null, null, null, 0, 10, false, mockToday);
    expect(low.score).toBeLessThan(25);
    expect(low.level).toBe('Low');

    // Score 25 - 44 -> Medium
    const medium = calculateSupplyRiskScore('Medium', 'Medium', null, null, null, 0, 10, false, mockToday);
    expect(medium.score).toBe(25);
    expect(medium.level).toBe('Medium');

    // Score 45 - 69 -> High
    const high = calculateSupplyRiskScore('High', 'High', null, null, null, 0, 10, false, mockToday);
    expect(high.score).toBe(45);
    expect(high.level).toBe('High');

    // Score >= 70 -> Critical
    const critical = calculateSupplyRiskScore('Critical', 'Critical', '2026-11-01', '2026-11-10', null, 0, 10, false, mockToday);
    expect(critical.score).toBe(95);
    expect(critical.level).toBe('Critical');
  });
});

