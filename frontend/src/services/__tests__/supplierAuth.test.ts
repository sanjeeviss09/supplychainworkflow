import { describe, it, expect } from 'vitest';
import {
  evaluateSupplierAuthorization,
  SupplierAuthContext,
} from '../supplierAuthService';
import { Employee, UserRole } from '@/types/database.types';

describe('Phase 6: 9-Step Supplier Authorization Algorithm', () => {
  const activeEmployee: Employee = {
    id: 'emp-101',
    user_id: 'usr-101',
    employee_id: 'SCM-001',
    full_name: 'Rajesh Varma',
    email: 'rajesh.varma@scmflow.com',
    department: 'Supply Chain Operations',
    designation: 'SCM Lead',
    assigned_role: 'scm_admin',
    is_active: true,
    must_change_password: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const baseContext: SupplierAuthContext = {
    isAuthenticated: true,
    employee: activeEmployee,
    role: 'scm_admin',
    supplier: {
      id: 'sup-001',
      supplier_code: 'SUP-000001',
      legal_name: 'PharmaTech Ingredients Pvt Ltd',
      supplier_status: 'ACTIVE',
      qualification_status: 'QUALIFIED',
    },
    dependentRecordCounts: {
      contacts: 0,
      addresses: 0,
      materials: 0,
      documents: 0,
      qualificationHistory: 0,
    },
  };

  // Step 1: Authentication Check
  it('Step 1: Rejects unauthenticated caller', () => {
    const res = evaluateSupplierAuthorization('suppliers.view', {
      ...baseContext,
      isAuthenticated: false,
    });
    expect(res.allowed).toBe(false);
    expect(res.reasonCode).toBe('AUTH_REQUIRED');
  });

  // Step 2: Employee Active Status Check
  it('Step 2: Rejects caller with missing or inactive employee record', () => {
    const noEmp = evaluateSupplierAuthorization('suppliers.view', {
      ...baseContext,
      employee: null,
    });
    expect(noEmp.allowed).toBe(false);
    expect(noEmp.reasonCode).toBe('EMPLOYEE_NOT_FOUND');

    const inactiveEmp = evaluateSupplierAuthorization('suppliers.view', {
      ...baseContext,
      employee: { ...activeEmployee, is_active: false },
    });
    expect(inactiveEmp.allowed).toBe(false);
    expect(inactiveEmp.reasonCode).toBe('EMPLOYEE_INACTIVE');
  });

  // Step 3: Explicit Security Denial Check
  it('Step 3: Enforces explicit security deny before evaluating role permissions', () => {
    const res = evaluateSupplierAuthorization('suppliers.view', {
      ...baseContext,
      explicitDeny: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.reasonCode).toBe('EXPLICIT_DENY');
  });

  // Step 4: Action Permission Check
  it('Step 4: Rejects caller without exact required action permission', () => {
    // scm_team_user does not have suppliers.create
    const res = evaluateSupplierAuthorization('suppliers.create', {
      ...baseContext,
      role: 'scm_team_user',
    });
    expect(res.allowed).toBe(false);
    expect(res.reasonCode).toBe('MISSING_PERMISSION');
  });

  // Step 6: Scope Rules Check
  it('Step 6: SCM Team User can view suppliers but cannot create or manage them', () => {
    const viewRes = evaluateSupplierAuthorization('suppliers.view', {
      ...baseContext,
      role: 'scm_team_user',
    });
    expect(viewRes.allowed).toBe(true);
    expect(viewRes.reasonCode).toBe('ALLOWED');

    const createRes = evaluateSupplierAuthorization('suppliers.create', {
      ...baseContext,
      role: 'scm_team_user',
    });
    expect(createRes.allowed).toBe(false);
  });

  // Step 8: Action-Specific Safeguards
  describe('Step 8 Safeguards: Deactivation, Reactivation & Deletion', () => {
    it('Safeguard A: Blocks permanent deletion if supplier has dependent records', () => {
      // With dependent contacts
      const blockedRes = evaluateSupplierAuthorization('suppliers.delete', {
        ...baseContext,
        role: 'super_admin',
        dependentRecordCounts: { contacts: 2, addresses: 1, materials: 3 },
      });
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.reasonCode).toBe('DELETE_BLOCKED_DEPENDENT_RECORDS');
      expect(blockedRes.message).toContain('Cannot delete supplier');

      // Without dependent records
      const allowedRes = evaluateSupplierAuthorization('suppliers.delete', {
        ...baseContext,
        role: 'super_admin',
        dependentRecordCounts: { contacts: 0, addresses: 0, materials: 0, documents: 0, qualificationHistory: 0 },
      });
      expect(allowedRes.allowed).toBe(true);
      expect(allowedRes.reasonCode).toBe('ALLOWED');
    });

    it('Safeguard B: Mandates reason for supplier deactivation', () => {
      const noReason = evaluateSupplierAuthorization('suppliers.deactivate', {
        ...baseContext,
        reason: '   ',
      });
      expect(noReason.allowed).toBe(false);
      expect(noReason.reasonCode).toBe('DEACTIVATION_REASON_REQUIRED');

      const withReason = evaluateSupplierAuthorization('suppliers.deactivate', {
        ...baseContext,
        reason: 'Supplier under corporate restructuring.',
      });
      expect(withReason.allowed).toBe(true);
      expect(withReason.reasonCode).toBe('ALLOWED');
    });

    it('Safeguard C: Mandates reason for supplier reactivation', () => {
      const noReason = evaluateSupplierAuthorization('suppliers.reactivate', {
        ...baseContext,
        reason: '',
      });
      expect(noReason.allowed).toBe(false);
      expect(noReason.reasonCode).toBe('REACTIVATION_REASON_REQUIRED');

      const withReason = evaluateSupplierAuthorization('suppliers.reactivate', {
        ...baseContext,
        reason: 'Quality audit successfully completed with valid accreditation.',
      });
      expect(withReason.allowed).toBe(true);
      expect(withReason.reasonCode).toBe('ALLOWED');
    });
  });

  describe('Step 8 Safeguards: Qualification & Material Associations', () => {
    it('Safeguard D: Mandates review notes when setting qualification to NOT_QUALIFIED or EXPIRED', () => {
      const failNotQual = evaluateSupplierAuthorization('supplier_qualification.update', {
        ...baseContext,
        newQualificationStatus: 'NOT_QUALIFIED',
        qualificationNotes: '',
      });
      expect(failNotQual.allowed).toBe(false);
      expect(failNotQual.reasonCode).toBe('QUALIFICATION_NOTE_REQUIRED');

      const passNotQual = evaluateSupplierAuthorization('supplier_qualification.update', {
        ...baseContext,
        newQualificationStatus: 'NOT_QUALIFIED',
        qualificationNotes: 'Failed facility sterility check during unannounced inspection.',
      });
      expect(passNotQual.allowed).toBe(true);

      const failExpired = evaluateSupplierAuthorization('supplier_qualification.update', {
        ...baseContext,
        newQualificationStatus: 'EXPIRED',
        qualificationNotes: '   ',
      });
      expect(failExpired.allowed).toBe(false);
      expect(failExpired.reasonCode).toBe('QUALIFICATION_NOTE_REQUIRED');

      // QUALIFIED does not strictly require rejection if note is omitted
      const passQualified = evaluateSupplierAuthorization('supplier_qualification.update', {
        ...baseContext,
        newQualificationStatus: 'QUALIFIED',
        qualificationNotes: '',
      });
      expect(passQualified.allowed).toBe(true);
    });

    it('Safeguard E: Blocks associating materials with an INACTIVE supplier', () => {
      const res = evaluateSupplierAuthorization('supplier_materials.manage', {
        ...baseContext,
        supplier: {
          ...baseContext.supplier,
          supplier_status: 'INACTIVE',
        },
      });
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('SUPPLIER_INACTIVE_FOR_NEW_ASSOCIATION');
      expect(res.message).toContain('inactive supplier');
    });

    it('Safeguard E: Validates MOQ > 0 and Lead Time >= 0', () => {
      const invalidMoq = evaluateSupplierAuthorization('supplier_materials.manage', {
        ...baseContext,
        moq: 0,
      });
      expect(invalidMoq.allowed).toBe(false);
      expect(invalidMoq.reasonCode).toBe('INVALID_MOQ');

      const negativeMoq = evaluateSupplierAuthorization('supplier_materials.manage', {
        ...baseContext,
        moq: -10,
      });
      expect(negativeMoq.allowed).toBe(false);
      expect(negativeMoq.reasonCode).toBe('INVALID_MOQ');

      const invalidLeadTime = evaluateSupplierAuthorization('supplier_materials.manage', {
        ...baseContext,
        leadTimeDays: -5,
      });
      expect(invalidLeadTime.allowed).toBe(false);
      expect(invalidLeadTime.reasonCode).toBe('INVALID_LEAD_TIME');

      const validParams = evaluateSupplierAuthorization('supplier_materials.manage', {
        ...baseContext,
        moq: 100,
        leadTimeDays: 14,
      });
      expect(validParams.allowed).toBe(true);
      expect(validParams.reasonCode).toBe('ALLOWED');
    });
  });
});
