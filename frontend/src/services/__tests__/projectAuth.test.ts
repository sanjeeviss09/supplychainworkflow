import { describe, it, expect } from 'vitest';
import {
  evaluateProjectAuthorization,
  ProjectAuthContext,
} from '../projectAuthService';
import { Employee, Project, ProjectExceptionGrant } from '@/types/database.types';

describe('Project & Milestone Authorization Engine (Centralized 9-step Decision Algorithm)', () => {
  const activeEmployee: Employee = {
    id: 'emp-001',
    employee_id: 'EMP-001',
    user_id: 'usr-001',
    full_name: 'John Doe',
    email: 'john@example.com',
    assigned_role: 'scm_team_user',
    department: 'Supply Chain',
    designation: 'SCM Specialist',
    is_active: true,
    must_change_password: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const testProject: Pick<Project, 'id' | 'department_id' | 'owner_employee_id' | 'status'> & { department_name?: string } = {
    id: 'prj-100',
    department_id: 'dept-1',
    owner_employee_id: 'emp-002',
    status: 'active',
    department_name: 'Supply Chain',
  };

  it('Step 1: Denies with AUTH_REQUIRED if user is not authenticated', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: false,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('AUTH_REQUIRED');
  });

  it('Step 2: Denies with EMPLOYEE_NOT_FOUND if employee record is missing', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: null,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('EMPLOYEE_NOT_FOUND');
  });

  it('Step 2: Denies with EMPLOYEE_INACTIVE if employee is deactivated', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: { ...activeEmployee, is_active: false },
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('EMPLOYEE_INACTIVE');
  });

  it('Step 3: Denies with EXPLICIT_DENY if explicit restriction is present', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'super_admin',
      explicitDeny: true,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('EXPLICIT_DENY');
  });

  it('Step 4: Denies with MISSING_PERMISSION if user lacks exact permission, even if project owner', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'scm_team_user',
      isProjectOwner: true,
      project: { ...testProject, owner_employee_id: activeEmployee.id },
      permissions: ['projects.view'], // lacks 'projects.delete'
    };
    const decision = evaluateProjectAuthorization('projects.delete', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('MISSING_PERMISSION');
  });

  it('Step 4: Denies with EXCEPTION_EXPIRED if exception grant has expired', () => {
    const expiredGrant: ProjectExceptionGrant = {
      id: 'grant-1',
      project_id: testProject.id,
      employee_id: activeEmployee.id,
      allowed_permissions: ['projects.update'],
      reason: 'Temporary coverage',
      granted_by: 'emp-admin',
      expires_at: '2026-01-01T00:00:00Z',
      is_revoked: false,
      created_at: '2025-12-01T00:00:00Z',
    };

    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'scm_team_user',
      permissions: [],
      exceptionGrants: [expiredGrant],
      referenceDate: new Date('2026-02-01T00:00:00Z'),
    };

    const decision = evaluateProjectAuthorization('projects.update', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('EXCEPTION_EXPIRED');
  });

  it('Allows general action without a specific project target', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'super_admin',
    };
    const decision = evaluateProjectAuthorization('projects.create', context);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('ALLOWED');
    expect(decision.effectiveScope).toBe('global');
  });

  it('Step 6: Denies SCM Admin with OUT_OF_SCOPE when department does not match and no exception', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: { ...activeEmployee, department: 'Logistics', assigned_role: 'scm_admin' },
      role: 'scm_admin',
      project: { ...testProject, department_name: 'Manufacturing' },
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('OUT_OF_SCOPE');
  });

  it('Step 6: Denies SCM Team User with NO_PROJECT_ACCESS if not owner, member, or exception holder', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'scm_team_user',
      project: testProject,
      isProjectOwner: false,
      isActiveProjectMember: false,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('NO_PROJECT_ACCESS');
  });

  it('Step 7: Safeguard - denies OWNER_CHANGE_DENIED to non-admin roles', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'scm_team_user',
      project: { ...testProject, owner_employee_id: activeEmployee.id },
      isProjectOwner: true,
      permissions: ['projects.manage_owner'],
    };
    const decision = evaluateProjectAuthorization('projects.manage_owner', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('OWNER_CHANGE_DENIED');
  });

  it('Step 7: Safeguard - denies ARCHIVE_NOT_PERMITTED if project is already archived', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: { ...activeEmployee, assigned_role: 'super_admin' },
      role: 'super_admin',
      project: { ...testProject, status: 'archived' },
    };
    const decision = evaluateProjectAuthorization('projects.archive', context);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('ARCHIVE_NOT_PERMITTED');
  });

  it('Step 8: Allows Super Admin with global scope', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: { ...activeEmployee, assigned_role: 'super_admin' },
      role: 'super_admin',
      project: testProject,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('ALLOWED');
    expect(decision.effectiveScope).toBe('global');
  });

  it('Step 8: Allows SCM Admin with matching department scope', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: { ...activeEmployee, assigned_role: 'scm_admin', department: 'Supply Chain' },
      role: 'scm_admin',
      project: testProject,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('ALLOWED');
    expect(decision.effectiveScope).toBe('department');
  });

  it('Step 8: Allows SCM Team User as project owner', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'scm_team_user',
      project: { ...testProject, owner_employee_id: activeEmployee.id },
      isProjectOwner: true,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('ALLOWED');
    expect(decision.effectiveScope).toBe('project_owner');
  });

  it('Step 8: Allows SCM Team User as active project member', () => {
    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: activeEmployee,
      role: 'scm_team_user',
      project: testProject,
      isActiveProjectMember: true,
    };
    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('ALLOWED');
    expect(decision.effectiveScope).toBe('project_member');
  });

  it('Step 8: Allows via valid ProjectExceptionGrant even across departments', () => {
    const validGrant: ProjectExceptionGrant = {
      id: 'grant-2',
      project_id: testProject.id,
      employee_id: activeEmployee.id,
      allowed_permissions: ['projects.view', 'projects.update'],
      reason: 'External audit support',
      granted_by: 'emp-admin',
      expires_at: '2026-12-31T23:59:59Z',
      is_revoked: false,
      created_at: '2026-01-01T00:00:00Z',
    };

    const context: ProjectAuthContext = {
      isAuthenticated: true,
      employee: { ...activeEmployee, department: 'Finance' },
      role: 'scm_team_user',
      project: testProject,
      exceptionGrants: [validGrant],
      referenceDate: new Date('2026-06-01T00:00:00Z'),
    };

    const decision = evaluateProjectAuthorization('projects.view', context);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('ALLOWED');
    expect(decision.effectiveScope).toBe('exception_grant');
  });
});
