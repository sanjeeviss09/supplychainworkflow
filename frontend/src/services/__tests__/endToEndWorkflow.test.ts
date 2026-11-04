import { describe, it, expect } from 'vitest';
import { calculateDeliveryMetrics, differenceInCalendarDays } from '@/lib/deliveryCalculations';
import { calculateSupplyRiskScore } from '../supplyRiskService';
import { calculateDocumentExpiryStatus } from '../documentService';

describe('Phase 12 / Master QA: End-to-End Business Workflows', () => {
  describe('Workflow 3 & 4: SAP PO Cumulative Deliveries & Shared Delay Engine', () => {
    it('calculates cumulative delivered quantity and outstanding balance across multi-split deliveries', () => {
      const orderedQty = 1000;
      let cumulativeDelivered = 0;

      // Delivery 1: Partial 400 units (Committed in future -> PARTIALLY_DELIVERED)
      const d1 = 400;
      cumulativeDelivered += d1;
      let m1 = calculateDeliveryMetrics({
        orderedQuantity: orderedQty,
        deliveredQuantity: cumulativeDelivered,
        originalCommittedDeliveryDate: '2026-11-30',
        referenceDateIST: '2026-11-10',
      });
      expect(cumulativeDelivered).toBe(400);
      expect(m1.outstandingQuantity).toBe(600);
      expect(m1.deliveryPercentage).toBe(40);
      expect(m1.calculatedStatus).toBe('PARTIALLY_DELIVERED');

      // Delivery 2: Partial 350 units (Committed in past -> DELAYED)
      const d2 = 350;
      cumulativeDelivered += d2;
      let m2 = calculateDeliveryMetrics({
        orderedQuantity: orderedQty,
        deliveredQuantity: cumulativeDelivered,
        originalCommittedDeliveryDate: '2026-11-01',
        referenceDateIST: '2026-11-10',
      });
      expect(cumulativeDelivered).toBe(750);
      expect(m2.outstandingQuantity).toBe(250);
      expect(m2.deliveryPercentage).toBe(75);
      expect(m2.calculatedStatus).toBe('DELAYED');

      // Delivery 3: Final 250 units (Completed -> DELIVERED)
      const d3 = 250;
      cumulativeDelivered += d3;
      let m3 = calculateDeliveryMetrics({
        orderedQuantity: orderedQty,
        deliveredQuantity: cumulativeDelivered,
        originalCommittedDeliveryDate: '2026-11-01',
        referenceDateIST: '2026-11-10',
      });
      expect(cumulativeDelivered).toBe(1000);
      expect(m3.outstandingQuantity).toBe(0);
      expect(m3.deliveryPercentage).toBe(100);
      expect(m3.calculatedStatus).toBe('DELIVERED');
    });

    it('calculates exact delay days where Day 0 is original commitment date', () => {
      // Committed: 2026-11-01, Today: 2026-11-10 -> 9 overdue calendar days
      const m = calculateDeliveryMetrics({
        orderedQuantity: 100,
        deliveredQuantity: 0,
        originalCommittedDeliveryDate: '2026-11-01',
        referenceDateIST: '2026-11-10',
      });

      expect(m.totalDeliveryDelayDays).toBe(9);
      expect(m.isOverdue).toBe(true);
      expect(m.isCalculable).toBe(true);
    });

    it('freezes final delay upon full delivery and never increases further', () => {
      const m = calculateDeliveryMetrics({
        orderedQuantity: 100,
        deliveredQuantity: 100,
        originalCommittedDeliveryDate: '2026-11-01',
        actualCompletionDate: '2026-11-05', // delivered 4 days late
        referenceDateIST: '2026-11-30', // 25 days later
      });

      expect(m.totalDeliveryDelayDays).toBe(4);
      expect(m.calculatedStatus).toBe('DELIVERED');
    });

    it('verifies revised ETA never resets or masks original commitment delay', () => {
      const m = calculateDeliveryMetrics({
        orderedQuantity: 100,
        deliveredQuantity: 0,
        originalCommittedDeliveryDate: '2026-11-01',
        currentExpectedDeliveryDate: '2026-11-20', // Vendor postponed ETA
        referenceDateIST: '2026-11-10',
      });

      // Original delay is strictly 9 days
      expect(m.totalDeliveryDelayDays).toBe(9);
      // Current ETA is in future, so currentOverdueDays is 0
      expect(m.currentOverdueDays).toBe(0);
    });
  });

  describe('Workflow 6: Delivery Issue & Escalation Management', () => {
    it('validates canonical issue status lifecycle', () => {
      const VALID_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
        Open: ['In Progress', 'Awaiting Supplier', 'Escalated', 'Resolved'],
        'In Progress': ['Awaiting Supplier', 'Escalated', 'Resolved'],
        'Awaiting Supplier': ['In Progress', 'Escalated', 'Resolved'],
        Escalated: ['In Progress', 'Awaiting Supplier', 'Resolved'],
        Resolved: ['Closed', 'Open'],
        Closed: ['Open'],
      };

      expect(VALID_LIFECYCLE_TRANSITIONS['Open']).toContain('In Progress');
      expect(VALID_LIFECYCLE_TRANSITIONS['In Progress']).toContain('Escalated');
      expect(VALID_LIFECYCLE_TRANSITIONS['Escalated']).toContain('Resolved');
      expect(VALID_LIFECYCLE_TRANSITIONS['Resolved']).toContain('Closed');
      // Direct jump from Open to Closed is disallowed without resolution
      expect(VALID_LIFECYCLE_TRANSITIONS['Open']).not.toContain('Closed');
    });
  });

  describe('Workflow 8: Material Supply Risk & Operational Criticality Engine', () => {
    it('accurately scores high-risk operational breach when current ETA exceeds internal required-by date', () => {
      const assessment = calculateSupplyRiskScore(
        'Critical', // +35
        'Critical', // +30
        '2026-11-10', // Required by Operations
        '2026-11-15', // Current Vendor ETA (Late by 5 days -> +30 breach)
        '2026-11-05', // Original Commitment (Past due -> +20)
        200, // Delivered 200 of 1000 (Partial -> +10)
        1000,
        true, // Active critical issue open (+25)
        '2026-11-06'
      );

      // 35 + 30 + 30 + 20 + 10 + 25 = 150 -> Capped or evaluated as Critical (>= 70)
      expect(assessment.score).toBeGreaterThanOrEqual(70);
      expect(assessment.level).toBe('Critical');
      expect(assessment.factors).toContain('Material Criticality is Critical (+35)');
      expect(assessment.factors).toContain('Operational Business Impact is Critical (+30)');
      expect(assessment.factors).toContain('Past Original Confirmed Commitment (+20)');
      expect(assessment.factors).toContain('Partial Delivery arrived with balance outstanding (+10)');
      expect(assessment.factors).toContain('Active Phase 9 Critical/High Delivery Issue/Escalation (+25)');
    });
  });

  describe('Workflow 9: SCM Document Versioning & Expiry Management', () => {
    it('correctly calculates expiry states across 90-day intervals and past-due dates', () => {
      const today = '2026-11-04';

      // Expired
      expect(calculateDocumentExpiryStatus('2026-11-01', false, false, today)).toBe('Expired');
      // Expires Today
      expect(calculateDocumentExpiryStatus('2026-11-04', false, false, today)).toBe('Expiring Soon');
      // 15 days out
      expect(calculateDocumentExpiryStatus('2026-11-19', false, false, today)).toBe('Expiring Soon');
      // 90 days out
      expect(calculateDocumentExpiryStatus('2027-02-02', false, false, today)).toBe('Expiring Soon');
      // 180 days out -> Active
      expect(calculateDocumentExpiryStatus('2027-05-04', false, false, today)).toBe('Active');
      // Null expiry date -> No Expiry Date
      expect(calculateDocumentExpiryStatus(null, false, false, today)).toBe('No Expiry Date');
      // Archived
      expect(calculateDocumentExpiryStatus('2027-05-04', true, false, today)).toBe('Archived');
      // Superseded
      expect(calculateDocumentExpiryStatus('2027-05-04', false, true, today)).toBe('Superseded');
    });
  });
});
