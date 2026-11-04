import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS_MAP, hasPermission, getPermissionsForRole } from '@/services/authService';
import { canAccessRoute } from '@/routes/routePermissions';
import { differenceInCalendarDays } from '@/lib/deliveryCalculations';

describe('Phase 10 Delivery Planning & Calendar Management', () => {
  it('strictly groups workload quantities by UOM without invalid cross-UOM summing', () => {
    // Sample test dataset with distinct UOMs
    const poLines = [
      { category: 'API', ordered_quantity: 100, delivered_quantity: 40, uom: 'KG' },
      { category: 'API', ordered_quantity: 50, delivered_quantity: 10, uom: 'KG' },
      { category: 'PM', ordered_quantity: 1000, delivered_quantity: 500, uom: 'BOX' },
      { category: 'EXE', ordered_quantity: 200, delivered_quantity: 50, uom: 'LTR' },
      { category: 'EXE', ordered_quantity: 300, delivered_quantity: 0, uom: 'LTR' },
    ];

    // Aggregator function replicating the business rule
    const grouped = new Map<string, { uom: string; category: string; outstanding: number; lines: number }>();

    poLines.forEach((line) => {
      const key = `${line.category}_${line.uom}`;
      const balance = line.ordered_quantity - line.delivered_quantity;

      if (!grouped.has(key)) {
        grouped.set(key, { uom: line.uom, category: line.category, outstanding: 0, lines: 0 });
      }

      const item = grouped.get(key)!;
      item.outstanding += balance;
      item.lines++;
    });

    // Verify API [KG] total is 60 + 40 = 100 KG
    expect(grouped.get('API_KG')?.outstanding).toBe(100);
    expect(grouped.get('API_KG')?.lines).toBe(2);

    // Verify PM [BOX] total is 500 BOX
    expect(grouped.get('PM_BOX')?.outstanding).toBe(500);
    expect(grouped.get('PM_BOX')?.lines).toBe(1);

    // Verify EXE [LTR] total is 150 + 300 = 450 LTR
    expect(grouped.get('EXE_LTR')?.outstanding).toBe(450);
    expect(grouped.get('EXE_LTR')?.lines).toBe(2);

    // Invariant: BOX and LTR or KG are never mixed together into a meaningless common sum
    expect(grouped.size).toBe(3);
  });

  it('evaluates delivery planning status indicators correctly', () => {
    const today = '2026-11-10';

    // Due Today: current expected date is today and balance remains
    const isDueToday = (eta: string, ordered: number, delivered: number) =>
      eta === today && delivered < ordered;

    expect(isDueToday('2026-11-10', 500, 200)).toBe(true);
    expect(isDueToday('2026-11-10', 500, 500)).toBe(false); // Fully delivered
    expect(isDueToday('2026-11-11', 500, 0)).toBe(false);

    // Upcoming: current expected date is in future and balance remains
    const isUpcoming = (eta: string, ordered: number, delivered: number) =>
      differenceInCalendarDays(today, eta) > 0 && delivered < ordered;

    expect(isUpcoming('2026-11-15', 100, 0)).toBe(true);
    expect(isUpcoming('2026-11-05', 100, 0)).toBe(false); // Past

    // Overdue: original committed date has passed and balance remains
    const isOverdue = (committedDate: string, ordered: number, delivered: number) =>
      differenceInCalendarDays(committedDate, today) > 0 && delivered < ordered;

    expect(isOverdue('2026-11-05', 100, 0)).toBe(true);
    expect(isOverdue('2026-11-15', 100, 0)).toBe(false);
  });

  it('grants Super Admin, SCM Admin, and SCM Team User planning view and export authority', () => {
    const roles = ['super_admin', 'scm_admin', 'scm_team_user'] as const;

    roles.forEach((r) => {
      const perms = getPermissionsForRole(r);
      expect(perms).toContain('delivery_planning.view');
      expect(perms).toContain('delivery_planning.export');
      expect(hasPermission(r, perms, 'delivery_planning.view')).toBe(true);
      expect(hasPermission(r, perms, 'delivery_planning.export')).toBe(true);
    });
  });

  it('allows authorized users to access /app/deliveries/planning route', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
    const scmAdminPerms = ROLE_PERMISSIONS_MAP.scm_admin;
    const scmTeamPerms = ROLE_PERMISSIONS_MAP.scm_team_user;

    expect(canAccessRoute('/app/deliveries/planning', superAdminPerms, true)).toBe(true);
    expect(canAccessRoute('/app/deliveries/planning', scmAdminPerms, true)).toBe(true);
    expect(canAccessRoute('/app/deliveries/planning', scmTeamPerms, true)).toBe(true);
  });

  it('denies inactive employee from accessing /app/deliveries/planning', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP.super_admin;
    expect(canAccessRoute('/app/deliveries/planning', superAdminPerms, false)).toBe(false);
  });
});

