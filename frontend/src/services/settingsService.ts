import { supabase } from '@/lib/supabase';
import { AppSetting } from '@/types/database.types';

/**
 * Fetches application settings (RLS enforces public settings for active employees, all settings for Super Admin).
 */
export async function fetchAppSettings(): Promise<{
  data: AppSetting[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('category', { ascending: true })
    .order('key', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data as AppSetting[]) || [] };
}

/**
 * Updates an application setting via trusted server-side RPC (Super Admin only, audited in audit_logs).
 */
export async function updateAppSetting(
  key: string,
  value: any
): Promise<{ data?: AppSetting; error?: string }> {
  const { data, error } = await supabase.rpc('admin_update_app_setting', {
    p_key: key,
    p_value: value,
  });

  if (error) {
    return { error: error.message };
  }

  return { data: data?.setting as AppSetting };
}

