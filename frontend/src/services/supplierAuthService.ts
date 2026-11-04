import {
  Employee,
  PermissionId,
  Supplier,
  SupplierQualificationStatus,
  UserRole,
} from '@/types/database.types';
import { ROLE_PERMISSIONS_MAP } from './authService';

export type SupplierAuthReasonCode =
  | 'AUTH_REQUIRED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'EMPLOYEE_INACTIVE'
  | 'EXPLICIT_DENY'
  | 'MISSING_PERMISSION'
  | 'SCOPE_UNVERIFIED'
  | 'OUT_OF_SCOPE'
  | 'SUPPLIER_INACTIVE_FOR_NEW_ASSOCIATION'
  | 'DELETE_BLOCKED_DEPENDENT_RECORDS'
  | 'DEACTIVATION_REASON_REQUIRED'
  | 'REACTIVATION_REASON_REQUIRED'
  | 'QUALIFICATION_NOTE_REQUIRED'
  | 'INVALID_MOQ'
  | 'INVALID_LEAD_TIME'
  | 'ALLOWED';

export interface SupplierAuthDecision {
  allowed: boolean;
  reasonCode: SupplierAuthReasonCode;
  message: string;
}

export interface SupplierAuthContext {
  isAuthenticated: boolean;
  employee?: Employee | null;
  role?: UserRole | null;
  permissions?: PermissionId[];
  supplier?: Partial<Supplier> | null;
  dependentRecordCounts?: {
    contacts?: number;
    addresses?: number;
    materials?: number;
    documents?: number;
    qualificationHistory?: number;
    purchaseOrders?: number;
    invoices?: number;
  };
  reason?: string;
  newQualificationStatus?: SupplierQualificationStatus;
  qualificationNotes?: string;
  moq?: number | null;
  leadTimeDays?: number | null;
  explicitDeny?: boolean;
}

/**
 * 9-Step Supplier Management Authorization Algorithm.
 * Implements strict default-deny and evaluates checks in the exact 9-step sequence.
 */
export function evaluateSupplierAuthorization(
  action: PermissionId,
  context: SupplierAuthContext
): SupplierAuthDecision {
  const {
    isAuthenticated,
    employee,
    role,
    permissions = [],
    supplier,
    dependentRecordCounts = {},
    reason = '',
    newQualificationStatus,
    qualificationNotes = '',
    moq,
    leadTimeDays,
    explicitDeny = false,
  } = context;

  // Step 1: Validate Authentication
  if (!isAuthenticated) {
    return {
      allowed: false,
      reasonCode: 'AUTH_REQUIRED',
      message: 'Authentication required. No valid session exists.',
    };
  }

  // Step 2: Confirm Employee is Active
  if (!employee) {
    return {
      allowed: false,
      reasonCode: 'EMPLOYEE_NOT_FOUND',
      message: 'No matching corporate employee record found for authenticated user.',
    };
  }

  if (!employee.is_active) {
    return {
      allowed: false,
      reasonCode: 'EMPLOYEE_INACTIVE',
      message: 'Employee account is inactive or access has been suspended.',
    };
  }

  // Step 3: Check Explicit Restrictions
  if (explicitDeny) {
    return {
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
      message: 'Access explicitly denied by security policy override.',
    };
  }

  // Step 4: Require Exact Action Permission
  const effectivePermissions = role ? ROLE_PERMISSIONS_MAP[role] || [] : permissions;
  const hasExactPerm = effectivePermissions.includes(action);

  if (!hasExactPerm) {
    return {
      allowed: false,
      reasonCode: 'MISSING_PERMISSION',
      message: `Missing required action permission: ${action}`,
    };
  }

  // Step 5: Resolve Resource Scope
  const hasViewAll = effectivePermissions.includes('suppliers.view_all');
  if (!role && !hasViewAll) {
    return {
      allowed: false,
      reasonCode: 'SCOPE_UNVERIFIED',
      message: 'Unable to verify supplier resource scope.',
    };
  }

  // Step 6: Apply Scope Rules
  // super_admin and scm_admin have global operational visibility
  // scm_team_user can view active and qualified suppliers in operational scope
  if (role === 'scm_team_user') {
    if (['suppliers.create', 'suppliers.update', 'suppliers.deactivate', 'suppliers.reactivate', 'suppliers.delete', 'supplier_contacts.manage', 'supplier_addresses.manage', 'supplier_materials.manage', 'supplier_qualification.update'].includes(action)) {
      return {
        allowed: false,
        reasonCode: 'OUT_OF_SCOPE',
        message: 'Action exceeds SCM Team User operational scope.',
      };
    }
  }

  // Step 7: Exception Grants Check (Placeholder for temporary delegation if configured)

  // Step 8: Action-Specific Safeguards
  // Safeguard A: Permanent Deletion Block if dependent records exist
  if (action === 'suppliers.delete') {
    const totalDeps =
      (dependentRecordCounts.contacts || 0) +
      (dependentRecordCounts.addresses || 0) +
      (dependentRecordCounts.materials || 0) +
      (dependentRecordCounts.documents || 0) +
      (dependentRecordCounts.qualificationHistory || 0) +
      (dependentRecordCounts.purchaseOrders || 0) +
      (dependentRecordCounts.invoices || 0);

    if (totalDeps > 0) {
      return {
        allowed: false,
        reasonCode: 'DELETE_BLOCKED_DEPENDENT_RECORDS',
        message: `Cannot delete supplier: supplier has ${totalDeps} dependent record(s). Deactivate instead.`,
      };
    }
  }

  // Safeguard B: Mandatory Reason for Deactivation
  if (action === 'suppliers.deactivate') {
    if (!reason || !reason.trim()) {
      return {
        allowed: false,
        reasonCode: 'DEACTIVATION_REASON_REQUIRED',
        message: 'Deactivation reason is mandatory.',
      };
    }
  }

  // Safeguard C: Mandatory Reason for Reactivation
  if (action === 'suppliers.reactivate') {
    if (!reason || !reason.trim()) {
      return {
        allowed: false,
        reasonCode: 'REACTIVATION_REASON_REQUIRED',
        message: 'Reactivation reason is mandatory.',
      };
    }
  }

  // Safeguard D: Mandatory Review Note when changing qualification to NOT_QUALIFIED or EXPIRED
  if (action === 'supplier_qualification.update') {
    if (
      (newQualificationStatus === 'NOT_QUALIFIED' || newQualificationStatus === 'EXPIRED') &&
      (!qualificationNotes || !qualificationNotes.trim())
    ) {
      return {
        allowed: false,
        reasonCode: 'QUALIFICATION_NOTE_REQUIRED',
        message: `Review note/reason is mandatory when changing qualification to ${newQualificationStatus}.`,
      };
    }
  }

  // Safeguard E: Inactive supplier cannot be selected for new material associations
  if (action === 'supplier_materials.manage') {
    if (supplier && supplier.supplier_status === 'INACTIVE') {
      return {
        allowed: false,
        reasonCode: 'SUPPLIER_INACTIVE_FOR_NEW_ASSOCIATION',
        message: 'Cannot associate materials with an inactive supplier.',
      };
    }

    if (moq !== undefined && moq !== null && moq <= 0) {
      return {
        allowed: false,
        reasonCode: 'INVALID_MOQ',
        message: 'Minimum order quantity must be greater than zero.',
      };
    }

    if (leadTimeDays !== undefined && leadTimeDays !== null && leadTimeDays < 0) {
      return {
        allowed: false,
        reasonCode: 'INVALID_LEAD_TIME',
        message: 'Lead time in calendar days must be a non-negative whole number.',
      };
    }
  }

  // Step 9: Allow Only If All Checks Pass
  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    message: 'Authorized to execute supplier action.',
  };
}

