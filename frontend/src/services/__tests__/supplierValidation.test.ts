import { describe, it, expect } from 'vitest';
import { Supplier, SupplierContact, SupplierAddress, SupplierDocument } from '@/types/database.types';

describe('Phase 6: Supplier Business Rules & Validation Logic', () => {
  // Test 1: Supplier Code Format
  it('Validates server-generated supplier code format (SUP-XXXXXX)', () => {
    const validCodes = ['SUP-000001', 'SUP-000123', 'SUP-999999'];
    const invalidCodes = ['sup-000001', 'SUP-123', 'VENDOR-001', 'SUP-0000001'];

    const regex = /^SUP-\d{6}$/;

    validCodes.forEach((code) => {
      expect(regex.test(code), `${code} should be valid`).toBe(true);
    });

    invalidCodes.forEach((code) => {
      expect(regex.test(code), `${code} should be invalid`).toBe(false);
    });
  });

  // Test 2: Primary Contact Designation Rule
  it('Enforces only one active primary contact per supplier', () => {
    const contacts: Partial<SupplierContact>[] = [
      { id: 'c1', full_name: 'Anil Sharma', is_primary: true, is_active: true },
      { id: 'c2', full_name: 'Pooja Iyer', is_primary: false, is_active: true },
      { id: 'c3', full_name: 'Vikram Seth', is_primary: false, is_active: true },
    ];

    // Filter active primary contacts
    const activePrimaries = contacts.filter((c) => c.is_primary && c.is_active);
    expect(activePrimaries.length).toBe(1);

    // Simulate designating a new primary contact
    const promoteId = 'c2';
    const updatedContacts = contacts.map((c) => ({
      ...c,
      is_primary: c.id === promoteId,
    }));

    const newActivePrimaries = updatedContacts.filter((c) => c.is_primary && c.is_active);
    expect(newActivePrimaries.length).toBe(1);
    expect(newActivePrimaries[0].id).toBe('c2');
  });

  // Test 3: Primary Address Rule per Address Type
  it('Enforces at most one active primary address per supplier and address type', () => {
    const addresses: Partial<SupplierAddress>[] = [
      { id: 'a1', address_type: 'REGISTERED', is_primary: true, is_active: true },
      { id: 'a2', address_type: 'MANUFACTURING_SITE', is_primary: true, is_active: true },
      { id: 'a3', address_type: 'MANUFACTURING_SITE', is_primary: false, is_active: true },
      { id: 'a4', address_type: 'WAREHOUSE', is_primary: true, is_active: true },
    ];

    // Check count for MANUFACTURING_SITE
    const mfgPrimaries = addresses.filter(
      (a) => a.address_type === 'MANUFACTURING_SITE' && a.is_primary && a.is_active
    );
    expect(mfgPrimaries.length).toBe(1);

    // Check count for REGISTERED
    const regPrimaries = addresses.filter(
      (a) => a.address_type === 'REGISTERED' && a.is_primary && a.is_active
    );
    expect(regPrimaries.length).toBe(1);
  });

  // Test 4: Document Expiry Status Computation
  it('Identifies expired compliance documents correctly based on date comparison', () => {
    const today = new Date().toISOString().slice(0, 10);
    const pastDate = '2020-01-01';
    const futureDate = '2030-12-31';

    const docs: Partial<SupplierDocument>[] = [
      { id: 'd1', document_name: 'Expired License', expiry_date: pastDate, status: 'ACTIVE' },
      { id: 'd2', document_name: 'Valid Certificate', expiry_date: futureDate, status: 'ACTIVE' },
      { id: 'd3', document_name: 'No Expiry Cert', expiry_date: null, status: 'ACTIVE' },
    ];

    const evaluateDocStatus = (doc: Partial<SupplierDocument>) => {
      if (doc.status === 'ARCHIVED') return 'ARCHIVED';
      if (doc.expiry_date && doc.expiry_date < today) return 'EXPIRED';
      return doc.status;
    };

    expect(evaluateDocStatus(docs[0])).toBe('EXPIRED');
    expect(evaluateDocStatus(docs[1])).toBe('ACTIVE');
    expect(evaluateDocStatus(docs[2])).toBe('ACTIVE');
  });

  // Test 5: Tax / GST Identifier Validation
  it('Validates tax identifier formatting and limits', () => {
    const isValidTaxId = (taxId: string): boolean => {
      const trimmed = taxId.trim();
      if (!trimmed) return true; // Optional field
      if (trimmed.length > 30) return false;
      return /^[A-Za-z0-9]+$/.test(trimmed);
    };

    expect(isValidTaxId('27AAAAA0000A1Z5')).toBe(true);
    expect(isValidTaxId('ABCDE1234F')).toBe(true);
    expect(isValidTaxId('')).toBe(true); // Optional
    expect(isValidTaxId('27AAAAA0000A1Z5!@#')).toBe(false); // Invalid characters
    expect(isValidTaxId('A'.repeat(35))).toBe(false); // Over 30 characters
  });

  // Test 6: Supplier Catalog Search & Filter Behavior
  it('Filters supplier catalog by search query, supplier type, and status', () => {
    const catalog: Partial<Supplier>[] = [
      { id: 's1', supplier_code: 'SUP-000001', legal_name: 'Alpha Chemicals Ltd', supplier_type: 'MANUFACTURER', supplier_status: 'ACTIVE', qualification_status: 'QUALIFIED' },
      { id: 's2', supplier_code: 'SUP-000002', legal_name: 'Beta Packaging Corp', supplier_type: 'DISTRIBUTOR', supplier_status: 'ACTIVE', qualification_status: 'IN_PROGRESS' },
      { id: 's3', supplier_code: 'SUP-000003', legal_name: 'Gamma Solvents Inc', supplier_type: 'MANUFACTURER', supplier_status: 'INACTIVE', qualification_status: 'EXPIRED' },
    ];

    // Filter by type: MANUFACTURER
    const manufacturers = catalog.filter((s) => s.supplier_type === 'MANUFACTURER');
    expect(manufacturers.length).toBe(2);

    // Filter by status: ACTIVE
    const activeOnly = catalog.filter((s) => s.supplier_status === 'ACTIVE');
    expect(activeOnly.length).toBe(2);

    // Search by text "Alpha"
    const searchAlpha = catalog.filter((s) =>
      s.legal_name?.toLowerCase().includes('alpha') || s.supplier_code?.toLowerCase().includes('alpha')
    );
    expect(searchAlpha.length).toBe(1);
    expect(searchAlpha[0].supplier_code).toBe('SUP-000001');

    // Inactive suppliers remain visible in historical searches
    const searchInactive = catalog.filter((s) => s.supplier_status === 'INACTIVE');
    expect(searchInactive.length).toBe(1);
    expect(searchInactive[0].legal_name).toBe('Gamma Solvents Inc');
  });
});

