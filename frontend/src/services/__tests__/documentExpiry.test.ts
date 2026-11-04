import { describe, it, expect } from 'vitest';
import { calculateDocumentExpiryStatus } from '../documentService';

describe('Phase 12: Document Expiry Status Calculation', () => {
  const mockToday = '2026-11-04';

  it('returns Archived when isArchived is true regardless of dates', () => {
    expect(calculateDocumentExpiryStatus('2026-12-01', true, false, mockToday)).toBe('Archived');
    expect(calculateDocumentExpiryStatus('2026-01-01', true, false, mockToday)).toBe('Archived');
    expect(calculateDocumentExpiryStatus(null, true, false, mockToday)).toBe('Archived');
  });

  it('returns Superseded when isSuperseded is true and not archived', () => {
    expect(calculateDocumentExpiryStatus('2026-12-01', false, true, mockToday)).toBe('Superseded');
    expect(calculateDocumentExpiryStatus(null, false, true, mockToday)).toBe('Superseded');
  });

  it('returns No Expiry Date when expiryDate is null or empty', () => {
    expect(calculateDocumentExpiryStatus(null, false, false, mockToday)).toBe('No Expiry Date');
    expect(calculateDocumentExpiryStatus(undefined, false, false, mockToday)).toBe('No Expiry Date');
    expect(calculateDocumentExpiryStatus('', false, false, mockToday)).toBe('No Expiry Date');
  });

  it('returns Expired when expiry date is in the past', () => {
    // 1 day past
    expect(calculateDocumentExpiryStatus('2026-11-03', false, false, mockToday)).toBe('Expired');
    // Several months past
    expect(calculateDocumentExpiryStatus('2026-06-15', false, false, mockToday)).toBe('Expired');
  });

  it('returns Expiring Soon when expiry date is today (0 days remaining)', () => {
    expect(calculateDocumentExpiryStatus('2026-11-04', false, false, mockToday)).toBe('Expiring Soon');
  });

  it('returns Expiring Soon when expiry date is within 90 days', () => {
    // 7 days away
    expect(calculateDocumentExpiryStatus('2026-11-11', false, false, mockToday)).toBe('Expiring Soon');
    // 30 days away
    expect(calculateDocumentExpiryStatus('2026-12-04', false, false, mockToday)).toBe('Expiring Soon');
    // 60 days away
    expect(calculateDocumentExpiryStatus('2027-01-03', false, false, mockToday)).toBe('Expiring Soon');
    // Exactly 90 days away
    const d90 = new Date('2026-11-04');
    d90.setDate(d90.getDate() + 90);
    expect(calculateDocumentExpiryStatus(d90.toISOString().slice(0, 10), false, false, mockToday)).toBe('Expiring Soon');
  });

  it('returns Active when expiry date is more than 90 days away', () => {
    // 91 days away
    const d91 = new Date('2026-11-04');
    d91.setDate(d91.getDate() + 91);
    expect(calculateDocumentExpiryStatus(d91.toISOString().slice(0, 10), false, false, mockToday)).toBe('Active');

    // 1 year away
    expect(calculateDocumentExpiryStatus('2027-11-04', false, false, mockToday)).toBe('Active');
  });
});

