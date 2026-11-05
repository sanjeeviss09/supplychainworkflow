import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  canAccessRoute,
  getAuthorizedNavItems,
  ROUTE_REGISTRY,
  PUBLIC_ROUTES,
} from '../routePermissions';
import { ROLE_PERMISSIONS_MAP, getPermissionsForRole } from '@/services/authService';
import { PermissionId } from '@/types/database.types';

describe('Phase 3 Centralized Route Authorization & Permission Matrix', () => {
  const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
  const scmAdminPerms = ROLE_PERMISSIONS_MAP.scm_admin;
  const scmTeamPerms = ROLE_PERMISSIONS_MAP.scm_team_user;

  it('contains the exact contract of 14 protected application routes in ROUTE_REGISTRY', () => {
    const expectedRoutes = [
      '/app/dashboard',
      '/app/profile',
      '/app/projects',
      '/app/materials',
      '/app/budgets-approvals',
      '/app/procurement',
      '/app/deliveries',
      '/app/reports',
      '/app/admin/employees',
      '/app/admin/imports',
      '/app/admin/audit-log',
      '/app/settings',
      '/app/settings/system',
      '/app/settings/scm',
    ];

    for (const route of expectedRoutes) {
      expect(ROUTE_REGISTRY[route], `Route ${route} must exist in ROUTE_REGISTRY`).toBeDefined();
      expect(ROUTE_REGISTRY[route].path).toBe(route);
    }
  });

  it('contains the exact contract of 6 public routes in PUBLIC_ROUTES', () => {
    const expectedPublic = [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/403',
      '/404',
    ];

    for (const r of expectedPublic) {
      expect(PUBLIC_ROUTES.has(r), `Public route ${r} must be in PUBLIC_ROUTES`).toBe(true);
    }
  });

  describe('Super Admin Route Authorization', () => {
    it('authorizes Super Admin for all routes in the exact contract', () => {
      const allAppRoutes = Object.keys(ROUTE_REGISTRY);

      for (const route of allAppRoutes) {
        const allowed = canAccessRoute(route, superAdminPerms, true);
        expect(allowed, `Super Admin must have access to ${route}`).toBe(true);
      }
    });
  });

  describe('SCM Admin Route Authorization & Least Privilege', () => {
    it('authorizes SCM Admin for SCM operational routes and SCM settings', () => {
      expect(canAccessRoute('/app/dashboard', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/profile', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/projects', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/materials', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/budgets-approvals', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/procurement', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/deliveries', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/reports', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/settings', scmAdminPerms, true)).toBe(true);
      expect(canAccessRoute('/app/settings/scm', scmAdminPerms, true)).toBe(true);
    });

    it('DENIES SCM Admin access to Super Admin administrative routes and global system settings', () => {
      // Must NOT be able to manage employees, import rosters, view audit logs, or manage system settings
      expect(canAccessRoute('/app/admin/employees', scmAdminPerms, true)).toBe(false);
      expect(canAccessRoute('/app/admin/imports', scmAdminPerms, true)).toBe(false);
      expect(canAccessRoute('/app/admin/audit-log', scmAdminPerms, true)).toBe(false);
      expect(canAccessRoute('/app/settings/system', scmAdminPerms, true)).toBe(false);
    });
  });

  describe('SCM Team User Route Authorization & Least Privilege', () => {
    it('authorizes SCM Team User only for permitted execution work areas and profile', () => {
      expect(canAccessRoute('/app/dashboard', scmTeamPerms, true)).toBe(true);
      expect(canAccessRoute('/app/profile', scmTeamPerms, true)).toBe(true);
      expect(canAccessRoute('/app/projects', scmTeamPerms, true)).toBe(true);
      expect(canAccessRoute('/app/materials', scmTeamPerms, true)).toBe(true);
      expect(canAccessRoute('/app/procurement', scmTeamPerms, true)).toBe(true);
      expect(canAccessRoute('/app/deliveries', scmTeamPerms, true)).toBe(true);
    });

    it('DENIES SCM Team User access to administrative, budget, report, and settings routes', () => {
      expect(canAccessRoute('/app/budgets-approvals', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/reports', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/admin/employees', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/admin/imports', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/admin/audit-log', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/settings', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/settings/system', scmTeamPerms, true)).toBe(false);
      expect(canAccessRoute('/app/settings/scm', scmTeamPerms, true)).toBe(false);
    });
  });

  describe('Conditional Route Rules: Budgets & Approvals, Settings', () => {
    it('/app/budgets-approvals allows access with budgets.view OR approvals.view, but denies when neither is present', () => {
      const permsWithBudgetOnly: PermissionId[] = ['budgets.view'];
      const permsWithApprovalOnly: PermissionId[] = ['approvals.view'];
      const permsWithNeither: PermissionId[] = ['projects.view', 'materials.view'];

      expect(canAccessRoute('/app/budgets-approvals', permsWithBudgetOnly, true)).toBe(true);
      expect(canAccessRoute('/app/budgets-approvals', permsWithApprovalOnly, true)).toBe(true);
      expect(canAccessRoute('/app/budgets-approvals', permsWithNeither, true)).toBe(false);
    });

    it('/app/settings allows access with settings.system.manage OR settings.scm.manage, but denies when neither is present', () => {
      const permsWithSystemOnly: PermissionId[] = ['settings.system.manage'];
      const permsWithScmOnly: PermissionId[] = ['settings.scm.manage'];
      const permsWithNeither: PermissionId[] = ['projects.view'];

      expect(canAccessRoute('/app/settings', permsWithSystemOnly, true)).toBe(true);
      expect(canAccessRoute('/app/settings', permsWithScmOnly, true)).toBe(true);
      expect(canAccessRoute('/app/settings', permsWithNeither, true)).toBe(false);
    });
  });

  describe('Default-Deny and Inactive Employee Security Enforcement', () => {
    it('DENIES all protected routes if an employee is inactive (is_active = false)', () => {
      // Even Super Admin permissions must be denied if employee account is marked inactive
      expect(canAccessRoute('/app/dashboard', superAdminPerms, false)).toBe(false);
      expect(canAccessRoute('/app/projects', superAdminPerms, false)).toBe(false);
      expect(canAccessRoute('/app/admin/employees', superAdminPerms, false)).toBe(false);
    });

    it('enforces Default-Deny on unlisted, unknown, or malformed routes', () => {
      expect(canAccessRoute('/app/secret-backdoor', superAdminPerms, true)).toBe(false);
      expect(canAccessRoute('/app/unknown-module', scmAdminPerms, true)).toBe(false);
      expect(canAccessRoute('/api/raw-export', scmTeamPerms, true)).toBe(false);
    });
  });

  describe('Role-Aware Navigation Derivation', () => {
    it('derives correct navigation items for Super Admin (all 17 nav items including Phases 7–12)', () => {
      const items = getAuthorizedNavItems(superAdminPerms, true);
      const paths = items.map((i) => i.path);

      expect(paths).toContain('/app/dashboard');
      expect(paths).toContain('/app/projects');
      expect(paths).toContain('/app/materials');
      expect(paths).toContain('/app/suppliers');
      expect(paths).toContain('/app/suppliers/performance');
      expect(paths).toContain('/app/budgets-approvals');
      expect(paths).toContain('/app/procurement');
      expect(paths).toContain('/app/deliveries');
      expect(paths).toContain('/app/deliveries/planning');
      expect(paths).toContain('/app/deliveries/issues');
      expect(paths).toContain('/app/deliveries/risks');
      expect(paths).toContain('/app/documents');
      expect(paths).toContain('/app/reports');
      expect(paths).toContain('/app/admin/employees');
      expect(paths).toContain('/app/admin/imports');
      expect(paths).toContain('/app/admin/audit-log');
      expect(paths).toContain('/app/settings');
      expect(items.length).toBe(17);
    });

    it('derives correct navigation items for SCM Admin (14 nav items including Phases 7–12, no employee management or audit logs)', () => {
      const items = getAuthorizedNavItems(scmAdminPerms, true);
      const paths = items.map((i) => i.path);

      expect(paths).toContain('/app/dashboard');
      expect(paths).toContain('/app/projects');
      expect(paths).toContain('/app/materials');
      expect(paths).toContain('/app/suppliers');
      expect(paths).toContain('/app/suppliers/performance');
      expect(paths).toContain('/app/budgets-approvals');
      expect(paths).toContain('/app/procurement');
      expect(paths).toContain('/app/deliveries');
      expect(paths).toContain('/app/deliveries/planning');
      expect(paths).toContain('/app/deliveries/issues');
      expect(paths).toContain('/app/deliveries/risks');
      expect(paths).toContain('/app/documents');
      expect(paths).toContain('/app/reports');
      expect(paths).toContain('/app/settings');

      expect(paths).not.toContain('/app/admin/employees');
      expect(paths).not.toContain('/app/admin/imports');
      expect(paths).not.toContain('/app/admin/audit-log');
      expect(items.length).toBe(14);
    });

    it('derives correct navigation items for SCM Team User (11 nav items including operational delivery modules)', () => {
      const items = getAuthorizedNavItems(scmTeamPerms, true);
      const paths = items.map((i) => i.path);

      expect(paths).toContain('/app/dashboard');
      expect(paths).toContain('/app/projects');
      expect(paths).toContain('/app/materials');
      expect(paths).toContain('/app/suppliers');
      expect(paths).toContain('/app/suppliers/performance');
      expect(paths).toContain('/app/procurement');
      expect(paths).toContain('/app/deliveries');
      expect(paths).toContain('/app/deliveries/planning');
      expect(paths).toContain('/app/deliveries/issues');
      expect(paths).toContain('/app/deliveries/risks');
      expect(paths).toContain('/app/documents');

      expect(paths).not.toContain('/app/budgets-approvals');
      expect(paths).not.toContain('/app/reports');
      expect(paths).not.toContain('/app/admin/employees');
      expect(paths).not.toContain('/app/admin/imports');
      expect(paths).not.toContain('/app/admin/audit-log');
      expect(paths).not.toContain('/app/settings');
      expect(items.length).toBe(11);
    });

    it('returns empty navigation list if employee is inactive', () => {
      expect(getAuthorizedNavItems(superAdminPerms, false)).toEqual([]);
    });
  });

  describe('Database Migration & Server-Side Security Verification', () => {
    it('verifies Phase 3 migration contains canonical permissions, role mappings, and self-approval denial function', () => {
      const phase3MigrationPath = path.resolve(
        __dirname,
        '../../../../backend/supabase/migrations/20261103030000_phase3_role_route_authorization.sql'
      );
      const sql = fs.readFileSync(phase3MigrationPath, 'utf-8');

      // 1. Canonical Phase 3 permissions
      expect(sql).toContain('profile.view.self');
      expect(sql).toContain('projects.view');
      expect(sql).toContain('materials.view');
      expect(sql).toContain('budgets.view');
      expect(sql).toContain('approvals.view');
      expect(sql).toContain('procurement.view');
      expect(sql).toContain('deliveries.view');
      expect(sql).toContain('reports.view');
      expect(sql).toContain('employees.manage');
      expect(sql).toContain('employees.import');
      expect(sql).toContain('audit.view');
      expect(sql).toContain('settings.system.manage');
      expect(sql).toContain('settings.scm.manage');

      // 2. Server-side check_can_approve function enforcing default denial of self-approval
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.check_can_approve');
      expect(sql).toContain('IF v_user_id IS NULL OR v_user_id = p_requester_id THEN');
      expect(sql).toContain('RETURN FALSE;');

      // 3. Server-side helper RPCs
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_user_has_permission');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_user_has_any_permission');
    });
  });
});

