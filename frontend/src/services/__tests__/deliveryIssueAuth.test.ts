import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS_MAP, hasPermission, getPermissionsForRole } from '@/services/authService';
import { canAccessRoute } from '@/routes/routePermissions';

describe('Phase 9 Delivery Issues Authorization & Access Control', () => {
  it('grants Super Admin full administration and closure authority for delivery issues', () => {
    const role = 'super_admin';
    const perms = getPermissionsForRole(role);

    expect(perms).toContain('delivery_issues.view');
    expect(perms).toContain('delivery_issues.create');
    expect(perms).toContain('delivery_issues.update');
    expect(perms).toContain('delivery_issues.reassign');
    expect(perms).toContain('delivery_issues.escalate');
    expect(perms).toContain('delivery_issues.resolve');
    expect(perms).toContain('delivery_issues.close');
    expect(perms).toContain('delivery_issues.export');

    expect(hasPermission(role, perms, 'delivery_issues.close')).toBe(true);
    expect(hasPermission(role, perms, 'delivery_issues.reassign')).toBe(true);
  });

  it('grants SCM Admin full management authority for delivery issues', () => {
    const role = 'scm_admin';
    const perms = getPermissionsForRole(role);

    expect(perms).toContain('delivery_issues.view');
    expect(perms).toContain('delivery_issues.create');
    expect(perms).toContain('delivery_issues.update');
    expect(perms).toContain('delivery_issues.reassign');
    expect(perms).toContain('delivery_issues.escalate');
    expect(perms).toContain('delivery_issues.resolve');
    expect(perms).toContain('delivery_issues.close');
    expect(perms).toContain('delivery_issues.export');

    expect(hasPermission(role, perms, 'delivery_issues.close')).toBe(true);
    expect(hasPermission(role, perms, 'delivery_issues.reassign')).toBe(true);
  });

  it('grants SCM Team User operational tracking, logging, and escalation authority but strictly denies closure and reassignment', () => {
    const role = 'scm_team_user';
    const perms = getPermissionsForRole(role);

    expect(perms).toContain('delivery_issues.view');
    expect(perms).toContain('delivery_issues.create');
    expect(perms).toContain('delivery_issues.update');
    expect(perms).toContain('delivery_issues.escalate');
    expect(perms).toContain('delivery_issues.resolve');

    // Denied administrative actions
    expect(perms).not.toContain('delivery_issues.close');
    expect(perms).not.toContain('delivery_issues.reassign');
    expect(perms).not.toContain('delivery_issues.export');

    expect(hasPermission(role, perms, 'delivery_issues.view')).toBe(true);
    expect(hasPermission(role, perms, 'delivery_issues.create')).toBe(true);
    expect(hasPermission(role, perms, 'delivery_issues.close')).toBe(false);
    expect(hasPermission(role, perms, 'delivery_issues.reassign')).toBe(false);
  });

  it('allows authorized users to access delivery issues routes', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
    const scmAdminPerms = ROLE_PERMISSIONS_MAP.scm_admin;
    const scmTeamPerms = ROLE_PERMISSIONS_MAP.scm_team_user;

    expect(canAccessRoute('/app/deliveries/issues', superAdminPerms, true)).toBe(true);
    expect(canAccessRoute('/app/deliveries/issues', scmAdminPerms, true)).toBe(true);
    expect(canAccessRoute('/app/deliveries/issues', scmTeamPerms, true)).toBe(true);
  });

  it('denies inactive employee from accessing delivery issues routes', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
    expect(canAccessRoute('/app/deliveries/issues', superAdminPerms, false)).toBe(false);
  });
});

