import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS_MAP, hasPermission } from '../authService';
import { PermissionId } from '@/types/database.types';

describe('Phase 12: SCM Document Management Authorization', () => {
  it('grants all documents permissions to super_admin', () => {
    const permissions: PermissionId[] = [
      'documents.view',
      'documents.upload',
      'documents.update',
      'documents.review',
      'documents.archive',
      'documents.export',
    ];

    permissions.forEach((perm) => {
      expect(hasPermission('super_admin', ROLE_PERMISSIONS_MAP.super_admin, perm)).toBe(true);
    });
  });

  it('grants all documents permissions to scm_admin', () => {
    const permissions: PermissionId[] = [
      'documents.view',
      'documents.upload',
      'documents.update',
      'documents.review',
      'documents.archive',
      'documents.export',
    ];

    permissions.forEach((perm) => {
      expect(hasPermission('scm_admin', ROLE_PERMISSIONS_MAP.scm_admin, perm)).toBe(true);
    });
  });

  it('grants operational documents permissions to scm_team_user but restricts archive and export', () => {
    // Allowed
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'documents.view')).toBe(true);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'documents.upload')).toBe(true);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'documents.update')).toBe(true);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'documents.review')).toBe(true);

    // Forbidden for team user
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'documents.archive')).toBe(false);
    expect(hasPermission('scm_team_user', ROLE_PERMISSIONS_MAP.scm_team_user, 'documents.export')).toBe(false);
  });

  it('denies documents permissions to unassigned or null roles', () => {
    expect(hasPermission(null, [], 'documents.view')).toBe(false);
    expect(hasPermission(null, [], 'documents.upload')).toBe(false);
    expect(hasPermission(null, [], 'documents.review')).toBe(false);
    expect(hasPermission(undefined, [], 'documents.export')).toBe(false);
  });
});

