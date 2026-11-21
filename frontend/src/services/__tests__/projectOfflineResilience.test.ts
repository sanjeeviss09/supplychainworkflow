import { describe, it, expect, vi } from 'vitest';
import { createProject } from '../projectService';
import { supabase } from '@/lib/supabase';

describe('Project Creation Offline / Network Failure Resilience', () => {
  it('creates project smoothly and returns valid data even if Supabase throws Failed to fetch', async () => {
    // Mock supabase.rpc to simulate network failure (Failed to fetch)
    const originalRpc = supabase.rpc;
    supabase.rpc = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      const res = await createProject({
        name: 'Folic acid',
        description: 'New API formulation',
        department_id: 'd1000000-0000-0000-0000-000000000001',
        owner_employee_id: '00000000-0000-0000-0000-000000000001',
        planned_start_date: '2026-11-21',
        planned_end_date: '2026-12-21',
      });

      expect(res.error).toBeUndefined();
      expect(res.data).toBeDefined();
      expect(res.data?.name).toBe('Folic acid');
      expect(res.data?.project_code).toMatch(/^PRJ-2026-\d{3}$/);
    } finally {
      supabase.rpc = originalRpc;
    }
  });
});
