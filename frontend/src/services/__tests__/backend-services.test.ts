import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateImportFileMetadata,
  validateEmployeeImportRows,
} from '../employeeService';
import {
  getPermissionsForRole,
  hasPermission,
  ROLE_PERMISSIONS_MAP,
} from '../authService';
import { sanitizeAuditPayload } from '../auditService';
import { Employee } from '@/types/database.types';

const mockExistingEmployees: Employee[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    employee_id: 'EMP-1001',
    full_name: 'Aarav Sharma',
    email: 'aarav.sharma@company.internal',
    department: 'Supply Chain Management',
    designation: 'SCM Manager',
    assigned_role: 'scm_admin',
    is_active: true,
    user_id: '22222222-2222-2222-2222-222222222222',
    must_change_password: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    employee_id: 'EMP-1002',
    full_name: 'Priya Nair',
    email: 'priya.nair@company.internal',
    department: 'Formulations & Synthesis',
    designation: 'Procurement Analyst',
    assigned_role: 'scm_team_user',
    is_active: true,
    user_id: null,
    must_change_password: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
];

describe('Phase 2 Backend Services — File & Employee Import Validation', () => {
  it('validates allowed import file extensions (.csv, .xlsx, .xls) and rejects unsupported or empty files', () => {
    expect(validateImportFileMetadata('employees_q4.csv', 2048)).toEqual({
      valid: true,
      fileType: 'csv',
    });
    expect(validateImportFileMetadata('roster.xlsx', 10240)).toEqual({
      valid: true,
      fileType: 'xlsx',
    });
    expect(validateImportFileMetadata('legacy_roster.xls', 4096)).toEqual({
      valid: true,
      fileType: 'xls',
    });

    const badExt = validateImportFileMetadata('malicious.exe', 1024);
    expect(badExt.valid).toBe(false);
    expect(badExt.error).toContain('Unsupported file type');

    const emptyFile = validateImportFileMetadata('empty.csv', 0);
    expect(emptyFile.valid).toBe(false);
    expect(emptyFile.error).toContain('empty');
  });

  it('classifies valid new rows as accepted_insert, modified existing rows as accepted_update, and unchanged rows as skipped', () => {
    const rawRows = [
      // 1. Brand new valid employee -> accepted_insert
      {
        employee_id: 'EMP-2001',
        full_name: 'Vikram Patel',
        email: 'vikram.patel@company.internal',
        department: 'Logistics & Warehousing',
        designation: 'Senior Buyer',
        assigned_role: 'scm_team_user',
      },
      // 2. Existing employee with updated role/designation -> accepted_update
      {
        employee_id: 'EMP-1002',
        full_name: 'Priya Nair',
        email: 'priya.nair@company.internal',
        department: 'Formulations & Synthesis',
        designation: 'Lead Procurement Manager',
        assigned_role: 'scm_admin',
      },
      // 3. Existing employee with identical fields -> skipped
      {
        employee_id: 'EMP-1001',
        full_name: 'Aarav Sharma',
        email: 'aarav.sharma@company.internal',
        department: 'Supply Chain Management',
        designation: 'SCM Manager',
        assigned_role: 'scm_admin',
      },
    ];

    const preview = validateEmployeeImportRows(
      'q4_roster.csv',
      'csv',
      rawRows,
      mockExistingEmployees
    );

    expect(preview.total_rows).toBe(3);
    expect(preview.accepted_rows).toBe(2);
    expect(preview.skipped_rows).toBe(1);
    expect(preview.rejected_rows).toBe(0);

    expect(preview.rows[0].outcome).toBe('accepted_insert');
    expect(preview.rows[1].outcome).toBe('accepted_update');
    expect(preview.rows[2].outcome).toBe('skipped');
  });

  it('NEVER silently assigns a default role when assigned_role is missing or invalid', () => {
    const rawRows = [
      {
        employee_id: 'EMP-3001',
        full_name: 'Missing Role Employee',
        email: 'missing.role@company.internal',
        department: 'Finance',
        designation: 'Analyst',
        assigned_role: '', // Missing role!
      },
      {
        employee_id: 'EMP-3002',
        full_name: 'Invalid Role Employee',
        email: 'invalid.role@company.internal',
        department: 'Finance',
        designation: 'Director',
        assigned_role: 'ceo_admin', // Invalid role!
      },
    ];

    const preview = validateEmployeeImportRows(
      'invalid_roles.csv',
      'csv',
      rawRows,
      mockExistingEmployees
    );

    expect(preview.accepted_rows).toBe(0);
    expect(preview.rejected_rows).toBe(2);

    expect(preview.rows[0].outcome).toBe('rejected');
    expect(preview.rows[0].is_valid).toBe(false);
    expect(preview.rows[0].error).toContain('Missing required field: assigned_role');

    expect(preview.rows[1].outcome).toBe('rejected');
    expect(preview.rows[1].is_valid).toBe(false);
    expect(preview.rows[1].error).toContain('Invalid role');
  });

  it('rejects duplicate employee IDs and duplicate work emails within the same import file and against DB conflicts', () => {
    const rawRows = [
      {
        employee_id: 'EMP-4001',
        full_name: 'First Entry',
        email: 'first.entry@company.internal',
        department: 'Supply Chain Management',
        designation: 'Analyst',
        assigned_role: 'scm_team_user',
      },
      {
        employee_id: 'EMP-4001', // Duplicate employee_id in file
        full_name: 'Second Entry Same ID',
        email: 'second.entry@company.internal',
        department: 'Supply Chain Management',
        designation: 'Analyst',
        assigned_role: 'scm_team_user',
      },
      {
        employee_id: 'EMP-4002',
        full_name: 'Duplicate Email In File',
        email: 'first.entry@company.internal', // Duplicate email in file
        department: 'Supply Chain Management',
        designation: 'Analyst',
        assigned_role: 'scm_team_user',
      },
      {
        employee_id: 'EMP-1001', // Matches EMP-1001 in DB
        full_name: 'Conflicting DB Record',
        email: 'priya.nair@company.internal', // Matches EMP-1002 in DB -> cross-record conflict!
        department: 'Supply Chain Management',
        designation: 'Analyst',
        assigned_role: 'scm_team_user',
      },
    ];

    const preview = validateEmployeeImportRows(
      'duplicates.csv',
      'csv',
      rawRows,
      mockExistingEmployees
    );

    expect(preview.accepted_rows).toBe(1);
    expect(preview.rejected_rows).toBe(3);

    expect(preview.rows[0].outcome).toBe('accepted_insert');
    expect(preview.rows[1].outcome).toBe('rejected');
    expect(preview.rows[1].error).toContain('Duplicate Employee ID');

    expect(preview.rows[2].outcome).toBe('rejected');
    expect(preview.rows[2].error).toContain('Duplicate Work Email');

    expect(preview.rows[3].outcome).toBe('rejected');
    expect(preview.rows[3].error).toContain('Database conflict');
  });
});

describe('Phase 2 Backend Services — Roles & Granular Permissions Matrix', () => {
  it('enforces least-privilege permission boundaries across super_admin, scm_admin, and scm_team_user', () => {
    // Super Admin has full administrative + operational permissions
    expect(hasPermission('super_admin', 'employees.import')).toBe(true);
    expect(hasPermission('super_admin', 'roles.assign')).toBe(true);
    expect(hasPermission('super_admin', 'audit.read')).toBe(true);
    expect(hasPermission('super_admin', 'settings.manage')).toBe(true);

    // SCM Admin can view employees and manage SCM operations, but cannot import employees, assign roles, or view security audit logs
    expect(hasPermission('scm_admin', 'employees.read')).toBe(true);
    expect(hasPermission('scm_admin', 'scm.projects.write')).toBe(true);
    expect(hasPermission('scm_admin', 'scm.orders.authorize')).toBe(true);
    expect(hasPermission('scm_admin', 'employees.import')).toBe(false);
    expect(hasPermission('scm_admin', 'roles.assign')).toBe(false);
    expect(hasPermission('scm_admin', 'audit.read')).toBe(false);

    // SCM Team User can view/write projects and requisitions, but has no employee/admin permissions
    expect(hasPermission('scm_team_user', 'scm.projects.read')).toBe(true);
    expect(hasPermission('scm_team_user', 'scm.requisitions.write')).toBe(true);
    expect(hasPermission('scm_team_user', 'scm.receiving.write')).toBe(true);
    expect(hasPermission('scm_team_user', 'employees.read')).toBe(false);
    expect(hasPermission('scm_team_user', 'employees.import')).toBe(false);
    expect(hasPermission('scm_team_user', 'scm.orders.authorize')).toBe(false);

    // Null / unauthenticated role has zero permissions
    expect(getPermissionsForRole(null)).toEqual([]);
    expect(hasPermission(null, 'scm.projects.read')).toBe(false);
    expect(ROLE_PERMISSIONS_MAP.super_admin.length).toBeGreaterThan(ROLE_PERMISSIONS_MAP.scm_admin.length);
  });
});

describe('Phase 2 Backend Services — Audit Log Secret Sanitization & Immutability', () => {
  it('strips passwords, tokens, service keys, and secrets from top-level and nested audit payloads', () => {
    const rawPayload = {
      employee_id: 'EMP-1001',
      email: 'aarav.sharma@company.internal',
      assigned_role: 'scm_admin',
      password: 'SuperSecretPassword123!',
      encrypted_password: '$2a$06$hashedvalue',
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      service_role_key: 'sb_secret_key_value',
      nested_meta: {
        ip_address: '10.20.30.40',
        refresh_token: 'refresh_secret_999',
        p_runtime_password: 'HiddenRuntimePassword',
        department: 'Supply Chain Management',
      },
    };

    const sanitized = sanitizeAuditPayload(rawPayload);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.employee_id).toBe('EMP-1001');
    expect(sanitized?.assigned_role).toBe('scm_admin');
    expect(sanitized?.password).toBeUndefined();
    expect(sanitized?.encrypted_password).toBeUndefined();
    expect(sanitized?.access_token).toBeUndefined();
    expect(sanitized?.service_role_key).toBeUndefined();

    const nested = sanitized?.nested_meta as Record<string, unknown>;
    expect(nested.ip_address).toBe('10.20.30.40');
    expect(nested.department).toBe('Supply Chain Management');
    expect(nested.refresh_token).toBeUndefined();
    expect(nested.p_runtime_password).toBeUndefined();
  });

  it('verifies Phase 2 SQL migration enforces RLS, 1:1 user linkage, immutable audit logs, and non-seeded passwords', () => {
    const phase2MigrationPath = path.resolve(
      __dirname,
      '../../../../backend/supabase/migrations/20261103020000_phase2_core_backend_security.sql'
    );
    const seedPath = path.resolve(__dirname, '../../../../backend/supabase/seed.sql');

    const migrationSql = fs.readFileSync(phase2MigrationPath, 'utf-8');
    const seedSql = fs.readFileSync(seedPath, 'utf-8');

    // 1. 1:1 user-to-employee unique constraint
    expect(migrationSql).toContain('uq_employees_user_id');

    // 2. Append-only immutable audit log trigger blocking UPDATE or DELETE
    expect(migrationSql).toContain('trg_immutable_audit_log');
    expect(migrationSql).toContain('BEFORE UPDATE OR DELETE ON public.audit_logs');

    // 3. Privilege escalation protection on employees table
    expect(migrationSql).toContain('trg_guard_employee_security_fields');
    expect(migrationSql).toContain('DROP POLICY IF EXISTS "Users update own password flag" ON public.employees');

    // 4. Transactional import preview & confirmation RPCs
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.preview_employee_import');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.confirm_employee_import');

    // 5. Seed SQL does not hardcode or auto-seed any plaintext password for AXX09
    expect(seedSql).toContain('provision_dev_account_axx09(p_runtime_password TEXT)');
    expect(seedSql).not.toContain("coalesce(nullif(trim(p_initial_secret), ''), 'AXX09')");
  });
});
