import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS_MAP, hasPermission, getPermissionsForRole } from '@/services/authService';
import { canAccessRoute } from '@/routes/routePermissions';

describe('Supplier Performance Analytics Authorization & Permissions', () => {
  it('grants Super Admin full view and export permissions for supplier performance', () => {
    const role = 'super_admin';
    const perms = getPermissionsForRole(role);

    expect(perms).toContain('supplier_performance.view');
    expect(perms).toContain('supplier_performance.export');
    expect(hasPermission(role, perms, 'supplier_performance.view')).toBe(true);
    expect(hasPermission(role, perms, 'supplier_performance.export')).toBe(true);
  });

  it('grants SCM Admin full view and export permissions for supplier performance', () => {
    const role = 'scm_admin';
    const perms = getPermissionsForRole(role);

    expect(perms).toContain('supplier_performance.view');
    expect(perms).toContain('supplier_performance.export');
    expect(hasPermission(role, perms, 'supplier_performance.view')).toBe(true);
    expect(hasPermission(role, perms, 'supplier_performance.export')).toBe(true);
  });

  it('grants SCM Team User view permission but strictly denies export permission', () => {
    const role = 'scm_team_user';
    const perms = getPermissionsForRole(role);

    expect(perms).toContain('supplier_performance.view');
    expect(perms).not.toContain('supplier_performance.export');
    expect(hasPermission(role, perms, 'supplier_performance.view')).toBe(true);
    expect(hasPermission(role, perms, 'supplier_performance.export')).toBe(false);
  });

  it('denies unauthenticated or null-role users from accessing supplier performance', () => {
    expect(hasPermission(null, [], 'supplier_performance.view')).toBe(false);
    expect(hasPermission(undefined, [], 'supplier_performance.view')).toBe(false);
  });

  it('allows authorized users to access /app/suppliers/performance route', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
    const scmAdminPerms = ROLE_PERMISSIONS_MAP.scm_admin;
    const scmTeamPerms = ROLE_PERMISSIONS_MAP.scm_team_user;

    expect(canAccessRoute('/app/suppliers/performance', superAdminPerms, true)).toBe(true);
    expect(canAccessRoute('/app/suppliers/performance', scmAdminPerms, true)).toBe(true);
    expect(canAccessRoute('/app/suppliers/performance', scmTeamPerms, true)).toBe(true);
  });

  it('denies inactive employee from accessing /app/suppliers/performance route', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
    // Inactive employee flag: is_active = false
    expect(canAccessRoute('/app/suppliers/performance', superAdminPerms, false)).toBe(false);
  });
});

