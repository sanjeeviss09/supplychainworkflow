import {
  Department,
  Employee,
  PermissionId,
  Project,
  ProjectExceptionGrant,
  UserRole,
} from '@/types/database.types';
import { ROLE_PERMISSIONS_MAP } from './authService';

export type ProjectAuthReasonCode =
  | 'AUTH_REQUIRED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'EMPLOYEE_INACTIVE'
  | 'EXPLICIT_DENY'
  | 'MISSING_PERMISSION'
  | 'SCOPE_UNVERIFIED'
  | 'OUT_OF_SCOPE'
  | 'NO_PROJECT_ACCESS'
  | 'EXCEPTION_INVALID'
  | 'EXCEPTION_EXPIRED'
  | 'OWNER_CHANGE_DENIED'
  | 'MEMBER_CHANGE_DENIED'
  | 'MILESTONE_ASSIGN_DENIED'
  | 'ARCHIVE_NOT_PERMITTED'
  | 'ALLOWED';

export interface ProjectAuthDecision {
  allowed: boolean;
  reasonCode: ProjectAuthReasonCode;
  message: string;
  effectiveScope?: 'global' | 'department' | 'project_owner' | 'project_member' | 'exception_grant';
}

export interface ProjectAuthContext {
  isAuthenticated: boolean;
  employee?: Employee | null;
  role?: UserRole | null;
  permissions?: PermissionId[];
  userDepartment?: string | null;
  project?: (Pick<Project, 'id' | 'department_id' | 'owner_employee_id' | 'status'> & { department_name?: string }) | null;
  isProjectOwner?: boolean;
  isActiveProjectMember?: boolean;
  explicitDeny?: boolean;
  exceptionGrants?: ProjectExceptionGrant[];
  referenceDate?: Date;
}

/**
 * Centralized Project & Milestone Authorization Decision Algorithm.
 * Implements strict default-deny and evaluates checks in the exact 9-step order.
 */
export function evaluateProjectAuthorization(
  action: PermissionId,
  context: ProjectAuthContext
): ProjectAuthDecision {
  const {
    isAuthenticated,
    employee,
    role,
    permissions = [],
    project,
    isProjectOwner = false,
    isActiveProjectMember = false,
    explicitDeny = false,
    exceptionGrants = [],
    referenceDate = new Date(),
  } = context;

  // Step 1: Authenticate
  if (!isAuthenticated) {
    return {
      allowed: false,
      reasonCode: 'AUTH_REQUIRED',
      message: 'Authentication required. No valid session exists.',
    };
  }

  // Step 2: Validate Employee
  if (!employee) {
    return {
      allowed: false,
      reasonCode: 'EMPLOYEE_NOT_FOUND',
      message: 'No matching corporate employee record found for authenticated identity.',
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
      message: 'An explicit security restriction denies access to this resource.',
    };
  }

  // Step 4: Check Exact Action Permission
  const rolePermissions = role ? ROLE_PERMISSIONS_MAP[role] || [] : [];
  const effectivePermissions = new Set<string>([...rolePermissions, ...permissions]);
  const hasExactPermission = effectivePermissions.has(action);

  // Check if an exception grant covers this action
  let validExceptionGrant: ProjectExceptionGrant | null = null;
  for (const grant of exceptionGrants) {
    if (grant.is_revoked) continue;
    const expiresAt = new Date(grant.expires_at);
    if (expiresAt < referenceDate) {
      return {
        allowed: false,
        reasonCode: 'EXCEPTION_EXPIRED',
        message: 'Project exception grant has expired.',
      };
    }
    if (grant.allowed_permissions && grant.allowed_permissions.includes(action)) {
      validExceptionGrant = grant;
      break;
    }
  }

  if (!hasExactPermission && !validExceptionGrant) {
    return {
      allowed: false,
      reasonCode: 'MISSING_PERMISSION',
      message: `User lacks required action permission: ${action}. Ownership or membership cannot substitute for action permissions.`,
    };
  }

  // If action is general (e.g. projects.create or view_all without a specific project target)
  if (!project) {
    return {
      allowed: true,
      reasonCode: 'ALLOWED',
      message: `Authorized for general action: ${action}`,
      effectiveScope: role === 'super_admin' ? 'global' : 'department',
    };
  }

  // Step 5: Resolve Project and Department Scope
  const projectDept = project.department_name;
  const userDept = employee.department;

  // Step 6: Check Project-Level Access & Scope
  if (role === 'super_admin') {
    // Super Admin has global platform scope
  } else if (role === 'scm_admin') {
    // SCM Admin must satisfy assigned department scope unless valid exception grant applies
    const matchesDept = projectDept && userDept && projectDept.trim().toLowerCase() === userDept.trim().toLowerCase();
    if (!matchesDept && !validExceptionGrant) {
      return {
        allowed: false,
        reasonCode: 'OUT_OF_SCOPE',
        message: `Project department (${projectDept || 'unknown'}) is outside assigned department scope (${userDept || 'none'}).`,
      };
    }
  } else {
    // SCM Team User: must be owner, active member, or hold valid exception grant
    const isOwner = isProjectOwner || project.owner_employee_id === employee.id;
    const isMember = isActiveProjectMember;

    if (!isOwner && !isMember && !validExceptionGrant) {
      return {
        allowed: false,
        reasonCode: 'NO_PROJECT_ACCESS',
        message: 'User is neither owner nor active member of this project.',
      };
    }
  }

  // Step 7: Action-Specific Safeguards
  if (action === 'projects.manage_owner') {
    if (role !== 'super_admin' && role !== 'scm_admin' && !validExceptionGrant) {
      return {
        allowed: false,
        reasonCode: 'OWNER_CHANGE_DENIED',
        message: 'Only authorized administrators may assign or reassign project owners.',
      };
    }
  }

  if (action === 'projects.manage_members') {
    if (role !== 'super_admin' && role !== 'scm_admin' && !validExceptionGrant) {
      return {
        allowed: false,
        reasonCode: 'MEMBER_CHANGE_DENIED',
        message: 'Managing project team members requires projects.manage_members authority.',
      };
    }
  }

  if (action === 'milestones.assign') {
    if (role !== 'super_admin' && role !== 'scm_admin' && !validExceptionGrant) {
      return {
        allowed: false,
        reasonCode: 'MILESTONE_ASSIGN_DENIED',
        message: 'Assigning milestones requires milestones.assign authority.',
      };
    }
  }

  if (action === 'projects.archive') {
    if (project.status === 'archived') {
      return {
        allowed: false,
        reasonCode: 'ARCHIVE_NOT_PERMITTED',
        message: 'Project is already archived.',
      };
    }
  }

  // Step 8: Allow
  let effectiveScope: ProjectAuthDecision['effectiveScope'] = 'project_member';
  if (role === 'super_admin') effectiveScope = 'global';
  else if (role === 'scm_admin') effectiveScope = 'department';
  else if (isProjectOwner || project.owner_employee_id === employee.id) effectiveScope = 'project_owner';
  else if (validExceptionGrant) effectiveScope = 'exception_grant';

  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    message: `Authorized for action: ${action}`,
    effectiveScope,
  };
}

