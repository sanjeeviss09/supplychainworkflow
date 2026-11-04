import {
  Employee,
  MaterialDeliveryTracking,
  PermissionId,
  UserRole,
} from '@/types/database.types';
import { ROLE_PERMISSIONS_MAP } from './authService';

export type DeliveryAuthReasonCode =
  | 'AUTH_REQUIRED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'EMPLOYEE_INACTIVE'
  | 'EXPLICIT_DENY'
  | 'MISSING_PERMISSION'
  | 'SCOPE_UNVERIFIED'
  | 'OUT_OF_SCOPE'
  | 'NOT_ASSIGNED_EMPLOYEE'
  | 'INVALID_DELIVERY_QUANTITY'
  | 'QUANTITY_OVERRUN_REQUIRES_OVERRIDE'
  | 'CANCELLATION_REASON_REQUIRED'
  | 'INACTIVE_REASSIGNMENT_TARGET'
  | 'DELAY_EXPLANATION_REQUIRED'
  | 'CORRECTIVE_ACTION_REQUIRED'
  | 'FOLLOWUP_DATE_REQUIRED'
  | 'SUPPLIER_UPDATE_REQUIRED'
  | 'BACKFILL_REASON_REQUIRED'
  | 'ALLOWED';

export interface DeliveryAuthDecision {
  allowed: boolean;
  reasonCode: DeliveryAuthReasonCode;
  message: string;
}

export interface DeliveryAuthContext {
  isAuthenticated: boolean;
  employee?: Employee | null;
  role?: UserRole | null;
  permissions?: PermissionId[];
  trackingRecord?: Partial<MaterialDeliveryTracking> | null;
  deliveryQuantity?: number;
  isOverrunOverride?: boolean;
  overrunReason?: string;
  cancellationReason?: string;
  reassignmentTargetEmployee?: Employee | null;
  delayRemark?: {
    delayExplanation?: string;
    correctiveAction?: string;
    nextFollowupDate?: string;
    supplierContacted?: boolean;
    supplierUpdate?: string;
    isBackfilled?: boolean;
    backfillReason?: string;
  };
  explicitDeny?: boolean;
}

/**
 * 9-Step Material Delivery Tracking Authorization Algorithm.
 * Implements strict default-deny and evaluates checks in the exact 9-step sequence.
 */
export function evaluateDeliveryAuthorization(
  action: PermissionId,
  context: DeliveryAuthContext
): DeliveryAuthDecision {
  const {
    isAuthenticated,
    employee,
    role,
    permissions = [],
    trackingRecord,
    deliveryQuantity,
    isOverrunOverride = false,
    overrunReason = '',
    cancellationReason = '',
    reassignmentTargetEmployee,
    delayRemark,
    explicitDeny = false,
  } = context;

  // Step 1: Validate Authentication
  if (!isAuthenticated) {
    return {
      allowed: false,
      reasonCode: 'AUTH_REQUIRED',
      message: 'Authentication required. No active session exists.',
    };
  }

  // Step 2: Confirm Active Employee
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

  // Step 3: Explicit Denial Check
  if (explicitDeny) {
    return {
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
      message: 'Access explicitly denied by security policy override.',
    };
  }

  // Step 4: Check Exact Action Permission
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
  const hasViewAll = effectivePermissions.includes('delivery_tracking.view_all');

  // Step 6: Apply Scope Rules
  // SCM Team User can only update deliveries assigned directly to them unless holding broader permission
  if (role === 'scm_team_user' && trackingRecord) {
    const isAssigned = trackingRecord.assigned_employee_id === employee.id;
    if (['delivery_updates.create', 'delivery_tracking.update', 'delivery_documents.upload'].includes(action)) {
      if (!isAssigned && !hasViewAll) {
        return {
          allowed: false,
          reasonCode: 'NOT_ASSIGNED_EMPLOYEE',
          message: 'You can only record delivery updates for PO lines assigned to you.',
        };
      }
    }
  }

  // Step 7: Exception Grants Check

  // Step 8: Action-Specific Safeguards
  // Safeguard A: Delivery Quantity Validation
  if (action === 'delivery_updates.create' && deliveryQuantity !== undefined) {
    if (deliveryQuantity <= 0) {
      return {
        allowed: false,
        reasonCode: 'INVALID_DELIVERY_QUANTITY',
        message: 'Delivered quantity must be strictly greater than zero.',
      };
    }

    if (trackingRecord && trackingRecord.ordered_quantity !== undefined) {
      const currentDelivered = trackingRecord.delivered_quantity || 0;
      const projectedTotal = currentDelivered + deliveryQuantity;

      if (projectedTotal > trackingRecord.ordered_quantity && !isOverrunOverride) {
        return {
          allowed: false,
          reasonCode: 'QUANTITY_OVERRUN_REQUIRES_OVERRIDE',
          message: `Cumulative delivery (${projectedTotal}) exceeds ordered quantity (${trackingRecord.ordered_quantity}). Overrun authorization required.`,
        };
      }
    }
  }

  // Safeguard B: Cancellation Justification
  if (action === 'delivery_tracking.cancel') {
    if (!cancellationReason || !cancellationReason.trim()) {
      return {
        allowed: false,
        reasonCode: 'CANCELLATION_REASON_REQUIRED',
        message: 'Mandatory cancellation justification is required.',
      };
    }
  }

  // Safeguard C: Reassignment Target Active Check
  if (action === 'delivery_tracking.reassign' && reassignmentTargetEmployee) {
    if (!reassignmentTargetEmployee.is_active) {
      return {
        allowed: false,
        reasonCode: 'INACTIVE_REASSIGNMENT_TARGET',
        message: 'Cannot assign delivery tracking to an inactive employee.',
      };
    }
  }

  // Safeguard D: Mandatory Daily Delay Remark Fields
  if (action === 'delivery_tracking.update' && delayRemark) {
    if (!delayRemark.delayExplanation || !delayRemark.delayExplanation.trim()) {
      return {
        allowed: false,
        reasonCode: 'DELAY_EXPLANATION_REQUIRED',
        message: 'Delay explanation cannot be blank.',
      };
    }

    if (!delayRemark.correctiveAction || !delayRemark.correctiveAction.trim()) {
      return {
        allowed: false,
        reasonCode: 'CORRECTIVE_ACTION_REQUIRED',
        message: 'Corrective action plan is mandatory.',
      };
    }

    if (!delayRemark.nextFollowupDate) {
      return {
        allowed: false,
        reasonCode: 'FOLLOWUP_DATE_REQUIRED',
        message: 'Next follow-up date is mandatory.',
      };
    }

    if (delayRemark.supplierContacted && (!delayRemark.supplierUpdate || !delayRemark.supplierUpdate.trim())) {
      return {
        allowed: false,
        reasonCode: 'SUPPLIER_UPDATE_REQUIRED',
        message: 'Supplier communication update is mandatory when supplier was contacted.',
      };
    }

    if (delayRemark.isBackfilled && (!delayRemark.backfillReason || !delayRemark.backfillReason.trim())) {
      return {
        allowed: false,
        reasonCode: 'BACKFILL_REASON_REQUIRED',
        message: 'Backfill justification is mandatory for previous dates.',
      };
    }
  }

  // Step 9: Allow Only If All Checks Pass
  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    message: 'Authorized to execute delivery tracking action.',
  };
}

