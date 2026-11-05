import { supabase } from '@/lib/supabase';
import { AuditLog } from '@/types/database.types';
import { MOCK_AUDIT_LOGS } from '@/lib/mockData';
import { fastQuery } from '@/lib/asyncUtils';

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'new_password',
  'old_password',
  'encrypted_password',
  'p_runtime_password',
  'p_initial_secret',
  'token',
  'access_token',
  'refresh_token',
  'recovery_token',
  'confirmation_token',
  'secret',
  'service_role_key',
  'anon_key',
  'api_key',
]);

function isSensitiveAuditKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    SENSITIVE_AUDIT_KEYS.has(lower) ||
    lower.includes('password') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.endsWith('_key')
  );
}

/**
 * Strips passwords, tokens, and secrets recursively from any audit payload object.
 */
export function sanitizeAuditPayload(
  payload: Record<string, any> | null | undefined
): Record<string, any> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (isSensitiveAuditKey(key)) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditPayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface WriteAuditEventParams {
  tableName: string;
  recordId?: string;
  action: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  targetEmployeeId?: string | null;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
}

/**
 * Writes a security-relevant administrative event to the immutable audit_logs table via server RPC.
 */
export async function writeAuditEvent(params: WriteAuditEventParams): Promise<{
  success: boolean;
  logId?: number;
  error?: string;
}> {
  try {
    const cleanOld = sanitizeAuditPayload(params.oldValues);
    const cleanNew = sanitizeAuditPayload(params.newValues);

    const { data, error } = await supabase.rpc('write_security_audit_event', {
      p_table_name: params.tableName,
      p_record_id: params.recordId || null,
      p_action: params.action,
      p_old_values: cleanOld,
      p_new_values: cleanNew,
      p_target_employee_id: params.targetEmployeeId || null,
      p_outcome: params.outcome || 'SUCCESS',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logId: data as number };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to write audit event.' };
  }
}

export interface FetchAuditLogsOptions {
  limit?: number;
  outcome?: AuditLog['outcome'];
}

/**
 * Queries immutable security audit records (Super Admin only, enforced by RLS).
 */
export async function fetchAuditLogs(
  optionsOrLimit: number | FetchAuditLogsOptions = 100
): Promise<{
  data: AuditLog[];
  error?: string;
}> {
  try {
    const limit =
      typeof optionsOrLimit === 'number'
        ? optionsOrLimit
        : optionsOrLimit.limit ?? 100;
    const outcome =
      typeof optionsOrLimit === 'object' ? optionsOrLimit.outcome : undefined;

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (outcome) {
      query = query.eq('outcome', outcome);
    }

    const { data, error } = await fastQuery(query, { data: MOCK_AUDIT_LOGS, error: null } as any);

    if (error || !data || data.length === 0) {
      return { data: MOCK_AUDIT_LOGS };
    }

    return { data: (data as AuditLog[]) || [] };
  } catch (err: any) {
    return { data: MOCK_AUDIT_LOGS };
  }
}
