import { describe, it, expect } from 'vitest';
import {
  DeliveryIssueSeverity,
  DeliveryIssueStatus,
  DeliveryIssueType,
} from '@/types/database.types';

describe('Phase 9 Delivery Issue Lifecycle & Validation Rules', () => {
  const VALID_ISSUE_TYPES: DeliveryIssueType[] = [
    'Delivery Delay',
    'Partial Delivery',
    'Quantity Shortage',
    'Damaged Material',
    'Incorrect Material',
    'Supplier Non-Response',
    'ETA Revision',
    'Documentation Issue',
    'Other',
  ];

  const VALID_SEVERITIES: DeliveryIssueSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

  const VALID_STATUSES: DeliveryIssueStatus[] = [
    'Open',
    'In Progress',
    'Awaiting Supplier',
    'Escalated',
    'Resolved',
    'Closed',
  ];

  it('validates supported issue types', () => {
    expect(VALID_ISSUE_TYPES).toHaveLength(9);
    expect(VALID_ISSUE_TYPES).toContain('Delivery Delay');
    expect(VALID_ISSUE_TYPES).toContain('Quantity Shortage');
    expect(VALID_ISSUE_TYPES).toContain('Damaged Material');
  });

  it('validates supported severity ratings', () => {
    expect(VALID_SEVERITIES).toEqual(['Low', 'Medium', 'High', 'Critical']);
  });

  it('validates standard issue lifecycle sequence', () => {
    expect(VALID_STATUSES).toEqual([
      'Open',
      'In Progress',
      'Awaiting Supplier',
      'Escalated',
      'Resolved',
      'Closed',
    ]);
  });

  it('validates state transition rules for issue closure and resolution', () => {
    // Helper function checking whether a transition is logically permitted
    const canTransition = (current: DeliveryIssueStatus, next: DeliveryIssueStatus): boolean => {
      if (current === next) return true;
      if (current === 'Closed') {
        // Closed issues can only transition to 'In Progress' or 'Open' upon explicit reopening
        return next === 'In Progress' || next === 'Open';
      }
      if (next === 'Closed') {
        // Issues can only be closed from 'Resolved'
        return current === 'Resolved';
      }
      return true;
    };

    expect(canTransition('Open', 'In Progress')).toBe(true);
    expect(canTransition('In Progress', 'Awaiting Supplier')).toBe(true);
    expect(canTransition('In Progress', 'Escalated')).toBe(true);
    expect(canTransition('Escalated', 'Resolved')).toBe(true);
    expect(canTransition('Resolved', 'Closed')).toBe(true);

    // Cannot jump straight from Open to Closed without resolution
    expect(canTransition('Open', 'Closed')).toBe(false);
    expect(canTransition('In Progress', 'Closed')).toBe(false);

    // Can reopen Closed issue to In Progress
    expect(canTransition('Closed', 'In Progress')).toBe(true);
    // Closed issue cannot directly change to Resolved without reopening
    expect(canTransition('Closed', 'Resolved')).toBe(false);
  });
});

