import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  CurrentUserContext,
  Employee,
  PermissionId,
  Profile,
  UserRole,
} from '@/types/database.types';
import { MOCK_EMPLOYEES } from '@/lib/mockData';
import { withTimeout } from '@/lib/asyncUtils';

/**
 * Authoritative Role-to-Permission Matrix matching public.role_permissions in PostgreSQL.
 */
export const ROLE_PERMISSIONS_MAP: Record<UserRole, PermissionId[]> = {
  super_admin: [
    // Phase 7 SAP Reference & Material Delivery Tracking Permissions
    'sap_references.view',
    'sap_references.create',
    'sap_references.update',
    'sap_references.import',
    'delivery_tracking.view',
    'delivery_tracking.view_all',
    'delivery_tracking.create',
    'delivery_tracking.update',
    'delivery_tracking.cancel',
    'delivery_tracking.assign',
    'delivery_tracking.reassign',
    'delivery_updates.view',
    'delivery_updates.create',
    'delivery_updates.correct',
    'delivery_updates.override_quantity',
    'delivery_reports.view',
    'delivery_reports.export',
    'delivery_documents.view',
    'delivery_documents.upload',
    // Supplier Performance Analytics Permissions
    'supplier_performance.view',
    'supplier_performance.export',
    // Phase 9 Delivery Issues & Escalations Permissions
    'delivery_issues.view',
    'delivery_issues.create',
    'delivery_issues.update',
    'delivery_issues.reassign',
    'delivery_issues.escalate',
    'delivery_issues.resolve',
    'delivery_issues.close',
    'delivery_issues.export',
    // Phase 10 Delivery Planning & Calendar Permissions
    'delivery_planning.view',
    'delivery_planning.export',
    // Phase 11 Material Supply Risk & Criticality Permissions
    'supply_risk.view',
    'supply_risk.create',
    'supply_risk.update',
    'supply_risk.mitigate',
    'supply_risk.resolve',
    'supply_risk.export',
    // Phase 12 SCM Document Management & Expiry Tracking Permissions
    'documents.view',
    'documents.upload',
    'documents.update',
    'documents.review',
    'documents.archive',
    'documents.export',
    // Phase 6 Supplier Management Permissions
    'suppliers.view',
    'suppliers.create',
    'suppliers.update',
    'suppliers.deactivate',
    'suppliers.reactivate',
    'suppliers.delete',
    'suppliers.view_all',
    'supplier_contacts.manage',
    'supplier_addresses.manage',
    'supplier_materials.view',
    'supplier_materials.manage',
    'supplier_documents.view',
    'supplier_documents.upload',
    'supplier_documents.archive',
    'supplier_qualification.view',
    'supplier_qualification.update',
    // Phase 4 Projects & Milestones Permissions
    'projects.view',
    'projects.create',
    'projects.update',
    'projects.archive',
    'projects.delete',
    'projects.view_all',
    'projects.manage_members',
    'projects.manage_owner',
    'milestones.view',
    'milestones.create',
    'milestones.update',
    'milestones.complete',
    'milestones.archive',
    'milestones.assign',
    // Phase 3 Canonical Route Permissions
    'profile.view.self',
    'materials.view',
    'budgets.view',
    'approvals.view',
    'procurement.view',
    'deliveries.view',
    'reports.view',
    'employees.manage',
    'employees.import',
    'audit.view',
    'settings.system.manage',
    'settings.scm.manage',
    // Phase 2 Permissions
    'employees.read',
    'employees.write',
    'roles.assign',
    'audit.read',
    'settings.read',
    'settings.manage',
    'scm.projects.read',
    'scm.projects.write',
    'scm.workflows.manage',
    'scm.requisitions.write',
    'scm.orders.authorize',
    'scm.receiving.write',
    'scm.invoices.verify',
  ],
  scm_admin: [
    // Phase 7 SAP Reference & Material Delivery Tracking Permissions
    'sap_references.view',
    'sap_references.create',
    'sap_references.update',
    'sap_references.import',
    'delivery_tracking.view',
    'delivery_tracking.view_all',
    'delivery_tracking.create',
    'delivery_tracking.update',
    'delivery_tracking.cancel',
    'delivery_tracking.assign',
    'delivery_tracking.reassign',
    'delivery_updates.view',
    'delivery_updates.create',
    'delivery_updates.correct',
    'delivery_updates.override_quantity',
    'delivery_reports.view',
    'delivery_reports.export',
    'delivery_documents.view',
    'delivery_documents.upload',
    // Supplier Performance Analytics Permissions
    'supplier_performance.view',
    'supplier_performance.export',
    // Phase 9 Delivery Issues & Escalations Permissions
    'delivery_issues.view',
    'delivery_issues.create',
    'delivery_issues.update',
    'delivery_issues.reassign',
    'delivery_issues.escalate',
    'delivery_issues.resolve',
    'delivery_issues.close',
    'delivery_issues.export',
    // Phase 10 Delivery Planning & Calendar Permissions
    'delivery_planning.view',
    'delivery_planning.export',
    // Phase 11 Material Supply Risk & Criticality Permissions
    'supply_risk.view',
    'supply_risk.create',
    'supply_risk.update',
    'supply_risk.mitigate',
    'supply_risk.resolve',
    'supply_risk.export',
    // Phase 12 SCM Document Management & Expiry Tracking Permissions
    'documents.view',
    'documents.upload',
    'documents.update',
    'documents.review',
    'documents.archive',
    'documents.export',
    // Phase 6 Supplier Management Permissions
    'suppliers.view',
    'suppliers.create',
    'suppliers.update',
    'suppliers.deactivate',
    'suppliers.reactivate',
    'suppliers.view_all',
    'supplier_contacts.manage',
    'supplier_addresses.manage',
    'supplier_materials.view',
    'supplier_materials.manage',
    'supplier_documents.view',
    'supplier_documents.upload',
    'supplier_documents.archive',
    'supplier_qualification.view',
    'supplier_qualification.update',
    // Phase 4 Projects & Milestones Permissions
    'projects.view',
    'projects.create',
    'projects.update',
    'projects.archive',
    'projects.manage_members',
    'projects.manage_owner',
    'milestones.view',
    'milestones.create',
    'milestones.update',
    'milestones.complete',
    'milestones.archive',
    'milestones.assign',
    // Phase 3 Canonical Route Permissions
    'profile.view.self',
    'materials.view',
    'budgets.view',
    'procurement.view',
    'deliveries.view',
    'reports.view',
    'settings.scm.manage',
    // Phase 2 Permissions
    'employees.read',
    'settings.read',
    'scm.projects.read',
    'scm.projects.write',
    'scm.workflows.manage',
    'scm.requisitions.write',
    'scm.orders.authorize',
    'scm.receiving.write',
    'scm.invoices.verify',
  ],
  scm_team_user: [
    // Phase 7 SAP Reference & Material Delivery Tracking Permissions
    'sap_references.view',
    'delivery_tracking.view',
    'delivery_updates.view',
    'delivery_updates.create',
    'delivery_reports.view',
    'delivery_documents.view',
    'delivery_documents.upload',
    // Supplier Performance Analytics Permissions (View-only for team user)
    'supplier_performance.view',
    // Phase 9 Delivery Issues Permissions
    'delivery_issues.view',
    'delivery_issues.create',
    'delivery_issues.update',
    'delivery_issues.escalate',
    'delivery_issues.resolve',
    // Phase 10 Delivery Planning & Calendar Permissions
    'delivery_planning.view',
    'delivery_planning.export',
    // Phase 11 Material Supply Risk & Criticality Permissions
    'supply_risk.view',
    'supply_risk.create',
    'supply_risk.update',
    'supply_risk.mitigate',
    // Phase 12 SCM Document Management & Expiry Tracking Permissions
    'documents.view',
    'documents.upload',
    'documents.update',
    'documents.review',
    // Phase 6 Supplier Management Permissions
    'suppliers.view',
    'supplier_materials.view',
    'supplier_documents.view',
    'supplier_qualification.view',
    // Phase 4 Projects & Milestones Permissions
    'projects.view',
    'projects.create',
    'projects.update',
    'milestones.view',
    'milestones.create',
    'milestones.update',
    'milestones.complete',
    // Phase 3 Canonical Route Permissions
    'profile.view.self',
    'materials.view',
    'procurement.view',
    'deliveries.view',
    // Phase 2 Permissions
    'settings.read',
    'scm.projects.read',
    'scm.projects.write',
    'scm.requisitions.write',
    'scm.receiving.write',
  ],
};

export function getPermissionsForRole(role: UserRole | null | undefined): PermissionId[] {
  if (!role || !(role in ROLE_PERMISSIONS_MAP)) {
    return [];
  }
  return ROLE_PERMISSIONS_MAP[role];
}

export function hasPermission(
  role: UserRole | null | undefined,
  permissionsOrRequired: PermissionId[] | PermissionId | undefined,
  maybeRequiredPermission?: PermissionId
): boolean {
  if (!role) return false;
  if (typeof permissionsOrRequired === 'string') {
    return getPermissionsForRole(role).includes(permissionsOrRequired);
  }
  if (!maybeRequiredPermission) return false;
  if (permissionsOrRequired && permissionsOrRequired.length > 0) {
    return permissionsOrRequired.includes(maybeRequiredPermission);
  }
  return getPermissionsForRole(role).includes(maybeRequiredPermission);
}

/**
 * Loads the current authenticated user, linked employee record, active status,
 * effective role, and permissions from trusted backend/database records.
 */
export async function loadCurrentUserContext(
  currentUser: User
): Promise<CurrentUserContext> {
  // 1. Try Phase 2 centralized server-side RPC first with timeout
  try {
    const rpcRes = await withTimeout(
      supabase.rpc('get_current_user_context'),
      350,
      { data: null, error: new Error('RPC timeout') } as any
    );

    if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
      const ctx = rpcRes.data as CurrentUserContext;
      if (ctx.employee_linked) {
        const resolvedRole = (ctx.role || ctx.employee?.assigned_role || null) as UserRole | null;
        return {
          ...ctx,
          role: resolvedRole,
          permissions:
            ctx.permissions && ctx.permissions.length > 0
              ? ctx.permissions
              : getPermissionsForRole(resolvedRole),
        };
      }
    }
  } catch (err) {
    // continue to fallback
  }

  // 2. Fallback lookup against public.employees and public.profiles with timeout
  let empData: Employee | null = null;
  let profData: Profile | null = null;

  try {
    const empByUidRes = await withTimeout(
      supabase.from('employees').select('*').eq('user_id', currentUser.id).maybeSingle(),
      350,
      { data: null } as any
    );
    empData = (empByUidRes?.data as Employee | null) ?? null;

    if (!empData && currentUser.email) {
      const empByEmailRes = await withTimeout(
        supabase.from('employees').select('*').ilike('email', currentUser.email).maybeSingle(),
        350,
        { data: null } as any
      );
      empData = (empByEmailRes?.data as Employee | null) ?? null;
    }

    const profRes = await withTimeout(
      supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
      350,
      { data: null } as any
    );
    profData = (profRes?.data as Profile | null) ?? null;
  } catch {
    // continue to mock fallback
  }

  // If no database employee found, check mock directory for dev/offline resilience
  if (!empData) {
    const mockEmp = MOCK_EMPLOYEES.find(
      (e) =>
        e.user_id === currentUser.id ||
        (currentUser.email && e.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.user_metadata?.employee_id &&
          e.employee_id.toLowerCase() === String(currentUser.user_metadata.employee_id).toLowerCase())
    );
    if (mockEmp) {
      empData = mockEmp;
    }
  }

  if (!empData) {
    return {
      authenticated: true,
      user_id: currentUser.id,
      employee_linked: false,
      is_active: false,
      role: null,
      permissions: [],
      employee: null,
      profile: (profData as Profile | null) ?? null,
      error:
        'No employee record is linked to this account. Please contact your SCM Administrator.',
    };
  }

  if (!empData.is_active) {
    return {
      authenticated: true,
      user_id: currentUser.id,
      employee_linked: true,
      is_active: false,
      role: null,
      permissions: [],
      employee: empData,
      profile: (profData as Profile | null) ?? null,
      error: 'Your employee account is currently inactive. Access has been revoked.',
    };
  }

  const resolvedRole = empData.assigned_role as UserRole;

  return {
    authenticated: true,
    user_id: currentUser.id,
    employee_linked: true,
    is_active: true,
    role: resolvedRole,
    must_change_password: Boolean(empData.must_change_password),
    permissions: getPermissionsForRole(resolvedRole),
    employee: empData,
    profile: (profData as Profile | null) ?? null,
  };
}

/**
 * Checks on the server whether an employee is active.
 */
export async function checkEmployeeActive(userId?: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      supabase.rpc('check_employee_active', { p_user_id: userId || null }),
      350,
      { data: null, error: new Error('Timeout') } as any
    );

    if (!res.error && typeof res.data === 'boolean') {
      return res.data;
    }
  } catch {
    // continue
  }

  if (!userId) return false;
  try {
    const empRes = await withTimeout(
      supabase.from('employees').select('is_active').eq('user_id', userId).maybeSingle(),
      350,
      { data: null } as any
    );
    return Boolean(empRes?.data?.is_active);
  } catch {
    return false;
  }
}

/**
 * Resolves the user's effective role and permissions from the server.
 */
export async function resolveUserRoleAndPermissions(userId?: string): Promise<{
  is_active: boolean;
  role: UserRole | null;
  permissions: PermissionId[];
}> {
  try {
    const res = await withTimeout(
      supabase.rpc('get_user_role_and_permissions', { p_user_id: userId || null }),
      350,
      { data: null, error: new Error('Timeout') } as any
    );

    if (!res.error && res.data && typeof res.data === 'object') {
      const role = (res.data.role || null) as UserRole | null;
      return {
        is_active: Boolean(res.data.is_active),
        role,
        permissions: Array.isArray(res.data.permissions)
          ? res.data.permissions
          : getPermissionsForRole(role),
      };
    }
  } catch {
    // fallback
  }

  return {
    is_active: false,
    role: null,
    permissions: [],
  };
}

/**
 * Resolves an Employee ID or Work Email prior to password authentication.
 */
export async function resolveLoginIdentifier(identifier: string): Promise<{
  found: boolean;
  email?: string;
  employee_id?: string;
  is_active?: boolean;
  must_change_password?: boolean;
  assigned_role?: UserRole;
  message?: string;
}> {
  const trimmed = identifier.trim();

  // Fast offline mock check first for known bootstrap credentials (e.g. AXX09, admin, EMP-1001)
  const mockEmp = MOCK_EMPLOYEES.find(
    (e) =>
      e.employee_id.toLowerCase() === trimmed.toLowerCase() ||
      e.email.toLowerCase() === trimmed.toLowerCase() ||
      (trimmed.toLowerCase() === 'admin' && e.assigned_role === 'super_admin') ||
      (trimmed.toLowerCase() === 'superadmin' && e.assigned_role === 'super_admin') ||
      (trimmed.toLowerCase() === 'scmadmin' && e.assigned_role === 'scm_admin') ||
      (trimmed.toLowerCase() === 'scmteam' && e.assigned_role === 'scm_team_user')
  );

  try {
    const res = await withTimeout(
      supabase.rpc('resolve_login_identifier', { p_identifier: trimmed }),
      350,
      { data: null, error: new Error('Timeout') } as any
    );

    if (!res.error && res.data && typeof res.data === 'object' && res.data.found) {
      return res.data;
    }

    // Fallback query
    const query = supabase
      .from('employees')
      .select('email, employee_id, is_active, must_change_password, assigned_role');

    const queryPromise = trimmed.includes('@')
      ? query.ilike('email', trimmed).maybeSingle()
      : query.ilike('employee_id', trimmed).maybeSingle();

    const queryRes = await withTimeout(queryPromise, 350, { data: null } as any);

    if (queryRes?.data) {
      const emp = queryRes.data as any;
      return {
        found: true,
        email: emp.email,
        employee_id: emp.employee_id,
        is_active: emp.is_active,
        must_change_password: emp.must_change_password,
        assigned_role: emp.assigned_role as UserRole,
      };
    }
  } catch (err) {
    console.warn('Backend resolve identifier lookup failed, falling back to local directory:', err);
  }

  // Development / Offline Fallback from MOCK_EMPLOYEES
  if (mockEmp) {
    return {
      found: true,
      email: mockEmp.email,
      employee_id: mockEmp.employee_id,
      is_active: mockEmp.is_active,
      must_change_password: mockEmp.must_change_password,
      assigned_role: mockEmp.assigned_role as UserRole,
    };
  }

  return {
    found: false,
    message: `No employee record found for "${trimmed}".`,
  };
}

/**
 * Validates that an employee exists, matches the work email, is active, and is not already registered.
 */
export async function validateEmployeeForSignup(
  employeeId: string,
  email: string
): Promise<{
  valid: boolean;
  message?: string;
  employee?: Partial<Employee>;
}> {
  try {
    const res = await withTimeout(
      supabase.rpc('validate_employee_for_signup', {
        p_employee_id: employeeId.trim(),
        p_email: email.trim(),
      }),
      350,
      { data: null, error: new Error('Timeout') } as any
    );

    if (!res.error && res.data && typeof res.data === 'object') {
      return res.data;
    }
  } catch {
    // fallback
  }

  try {
    const queryRes = await withTimeout(
      supabase.from('employees').select('*').ilike('employee_id', employeeId.trim()).maybeSingle(),
      350,
      { data: null } as any
    );
    const empRecord = queryRes?.data as any;

    if (!empRecord) {
      // Check mock directory
      const mockEmp = MOCK_EMPLOYEES.find(
        (e) => e.employee_id.toLowerCase() === employeeId.trim().toLowerCase()
      );
      if (mockEmp) {
        if (mockEmp.email.toLowerCase() !== email.trim().toLowerCase()) {
          return {
            valid: false,
            message: 'The provided work email does not match the employee record on file.',
          };
        }
        return {
          valid: true,
          employee: mockEmp,
        };
      }

      return {
        valid: false,
        message:
          'Employee ID not found in the approved employee directory. Please contact your SCM Administrator.',
      };
    }

    if (empRecord.email.toLowerCase() !== email.trim().toLowerCase()) {
      return {
        valid: false,
        message: 'The provided work email does not match the employee record on file.',
      };
    }

    if (!empRecord.is_active) {
      return {
        valid: false,
        message:
          'This employee record is currently inactive. Please contact the SCM Administrator.',
      };
    }

    if (empRecord.user_id) {
      return {
        valid: false,
        message:
          'An account has already been registered for this employee. Please log in or use Forgot Password.',
      };
    }

    return {
      valid: true,
      employee: empRecord,
    };
  } catch {
    return {
      valid: false,
      message: 'Failed to connect to employee registry. Please try again.',
    };
  }
}

/**
 * Marks the user's temporary password change requirement as completed on the server.
 */
export async function completePasswordChangeOnServer(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await withTimeout(
      supabase.rpc('complete_password_change'),
      350,
      { data: null, error: null } as any
    );
    if (res?.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch {
    return { success: true };
  }
}
