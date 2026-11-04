import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS_MAP, hasPermission } from '../authService';
import { PermissionId } from '@/types/database.types';

describe('Phase 11: Supply Risk Role & Authorization', () => {
  it('grants full supply_risk permissions to super_admin', () => {
    const permissions: PermissionId[] = [
      'supply_risk.view',
      'supply_risk.create',
      'supply_risk.update',
      'supply_risk.mitigate',
      'supply_risk.resolve',
      'supply_risk.export',
    ];

    permissions.forEach((perm) => {
      expect(hasPermission('super_admin', ROLE_PERMISSIONS_MAP.super_admin, perm)).toBe(true);
    });
  });

  it('grants full supply_risk permissions to scm_admin', () => {
    const permissions: PermissionId[] = [
      'supply_risk.view',
      'supply_risk.create',
      'supply_risk.update',
      'supply_risk.mitigate',
      'supply_risk.resolve',
      'supply_risk.export',
    ];

    permissions.forEach((perm) => {
      expect(hasPermission('scm_admin', ROLE_PERMISSIONS_MAP.scm_admin, perm)).toBe(true);
    });
  });

  it('grants operational permissions to scm_team_user but restricts resolve and export', () => {
    // Allowed
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'supply_risk.view')).toBe(true);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'supply_risk.create')).toBe(true);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'supply_risk.update')).toBe(true);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'supply_risk.mitigate')).toBe(true);

    // Forbidden for team user (administrative authority only)
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'supply_risk.resolve')).toBe(false);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'supply_risk.export')).toBe(false);
  });

  it('denies supply_risk permissions to unassigned or null roles', () => {
    expect(hasPermission(null, [], 'supply_risk.create')).toBe(false);
    expect(hasPermission(null, [], 'supply_risk.mitigate')).toBe(false);
    expect(hasPermission(null, [], 'supply_risk.resolve')).toBe(false);
    expect(hasPermission(undefined, [], 'supply_risk.export')).toBe(false);
  });
});
