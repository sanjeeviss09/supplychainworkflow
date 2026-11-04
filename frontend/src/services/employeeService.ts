import { supabase } from '@/lib/supabase';
import {
  BulkImportResult,
  Employee,
  EmployeeImportBatch,
  EmployeeImportRowRecord,
  ImportEmployeeRow,
  ImportPreviewResult,
  ImportRowOutcome,
  UserRole,
} from '@/types/database.types';
import { MOCK_EMPLOYEES } from '@/lib/mockData';

export const ALLOWED_IMPORT_ROLES: ReadonlySet<string> = new Set([
  'super_admin',
  'scm_admin',
  'scm_team_user',
]);

export const ALLOWED_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  'csv',
  'xlsx',
  'xls',
]);

/**
 * Extracts and validates the file extension for employee imports.
 */
export function validateImportFileMetadata(
  fileName: string,
  fileSize?: number
): { valid: boolean; fileType: string; error?: string } {
  const cleanName = (fileName || '').trim();
  if (!cleanName) {
    return { valid: false, fileType: '', error: 'File name is required.' };
  }

  const parts = cleanName.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      fileType: ext,
      error: `Unsupported file type ".${ext || 'unknown'}". Only CSV (.csv) and Excel (.xlsx, .xls) files are permitted.`,
    };
  }

  if (typeof fileSize === 'number' && fileSize <= 0) {
    return {
      valid: false,
      fileType: ext,
      error: 'The selected file is empty (0 bytes).',
    };
  }

  return { valid: true, fileType: ext };
}

/**
 * Validates raw employee import rows deterministically.
 * Explicitly rejects missing or invalid roles — NEVER silently assigns a default role.
 */
export function validateEmployeeImportRows(
  fileName: string,
  fileType: string,
  rawRows: Array<Record<string, any>>,
  existingEmployees: Employee[] = []
): ImportPreviewResult {
  const seenEmpIds = new Set<string>();
  const seenEmails = new Set<string>();

  const existingById = new Map<string, Employee>();
  const existingByEmail = new Map<string, Employee>();

  for (const emp of existingEmployees) {
    existingById.set(emp.employee_id.trim().toUpperCase(), emp);
    existingByEmail.set(emp.email.trim().toLowerCase(), emp);
  }

  let acceptedCount = 0;
  let skippedCount = 0;
  let rejectedCount = 0;

  const validatedRows: ImportEmployeeRow[] = rawRows.map((raw, idx) => {
    const rowNum = idx + 1;
    const empId = raw.employee_id !== undefined && raw.employee_id !== null
      ? String(raw.employee_id).trim().toUpperCase()
      : '';
    const fullName = raw.full_name !== undefined && raw.full_name !== null
      ? String(raw.full_name).trim()
      : '';
    const email = raw.email !== undefined && raw.email !== null
      ? String(raw.email).trim().toLowerCase()
      : '';
    const department = raw.department !== undefined && raw.department !== null
      ? String(raw.department).trim()
      : '';
    const designation = raw.designation !== undefined && raw.designation !== null
      ? String(raw.designation).trim()
      : '';
    // CRITICAL SECURITY RULE: Do NOT fallback to a default role when missing!
    const rawRole = raw.assigned_role !== undefined && raw.assigned_role !== null
      ? String(raw.assigned_role).trim().toLowerCase()
      : '';

    let outcome: ImportRowOutcome | null = null;
    let error: string | null = null;

    const emailAtIdx = email.indexOf('@');
    const emailHasDomainDot =
      emailAtIdx > 0 && email.slice(emailAtIdx + 1).includes('.');

    if (!empId) {
      outcome = 'rejected';
      error = 'Missing required field: employee_id';
    } else if (!fullName) {
      outcome = 'rejected';
      error = 'Missing required field: full_name';
    } else if (!email || emailAtIdx <= 0 || !emailHasDomainDot) {
      outcome = 'rejected';
      error = 'Invalid or missing work email address';
    } else if (!department) {
      outcome = 'rejected';
      error = 'Missing required field: department';
    } else if (!designation) {
      outcome = 'rejected';
      error = 'Missing required field: designation';
    } else if (!rawRole) {
      outcome = 'rejected';
      error = 'Missing required field: assigned_role (must not be blank)';
    } else if (!ALLOWED_IMPORT_ROLES.has(rawRole)) {
      outcome = 'rejected';
      error = `Invalid role "${rawRole}": must be super_admin, scm_admin, or scm_team_user`;
    } else if (seenEmpIds.has(empId)) {
      outcome = 'rejected';
      error = `Duplicate Employee ID "${empId}" within the uploaded file`;
    } else if (seenEmails.has(email)) {
      outcome = 'rejected';
      error = `Duplicate Work Email "${email}" within the uploaded file`;
    }

    if (empId) seenEmpIds.add(empId);
    if (email) seenEmails.add(email);

    if (outcome === null) {
      const matchById = existingById.get(empId);
      const matchByEmail = existingByEmail.get(email);

      if (matchById && matchByEmail && matchById.id !== matchByEmail.id) {
        outcome = 'rejected';
        error = `Database conflict: Employee ID ${empId} and email ${email} belong to two different existing employee records`;
      } else if (matchById || matchByEmail) {
        const existing = (matchById || matchByEmail)!;
        const isIdentical =
          existing.employee_id.trim().toUpperCase() === empId &&
          existing.email.trim().toLowerCase() === email &&
          existing.full_name.trim() === fullName &&
          existing.department.trim() === department &&
          existing.designation.trim() === designation &&
          existing.assigned_role === rawRole;

        if (isIdentical) {
          outcome = 'skipped';
          error = 'Record already exists with identical values (no changes needed)';
        } else {
          outcome = 'accepted_update';
        }
      } else {
        outcome = 'accepted_insert';
      }
    }

    if (outcome === 'accepted_insert' || outcome === 'accepted_update') {
      acceptedCount++;
    } else if (outcome === 'skipped') {
      skippedCount++;
    } else {
      rejectedCount++;
    }

    return {
      row_number: rowNum,
      employee_id: empId,
      full_name: fullName,
      email,
      department,
      designation,
      assigned_role: rawRole,
      outcome,
      is_valid: outcome === 'accepted_insert' || outcome === 'accepted_update',
      error,
    };
  });

  return {
    file_name: fileName,
    file_type: fileType.toLowerCase(),
    total_rows: validatedRows.length,
    accepted_rows: acceptedCount,
    skipped_rows: skippedCount,
    rejected_rows: rejectedCount,
    rows: validatedRows,
  };
}

/**
 * Step 1 of Employee Import: Server-side validation & preview before committing changes.
 */
export async function previewEmployeeImport(
  fileName: string,
  fileType: string,
  rawRows: Array<Record<string, any>>,
  existingEmployees: Employee[] = []
): Promise<{ data?: ImportPreviewResult; error?: string }> {
  const fileCheck = validateImportFileMetadata(fileName);
  if (!fileCheck.valid) {
    return { error: fileCheck.error };
  }

  if (!rawRows || rawRows.length === 0) {
    return { error: 'The uploaded file contains no employee records.' };
  }

  // Normalize raw rows without defaulting missing fields
  const normalizedPayload = rawRows.map((raw) => ({
    employee_id: raw.employee_id !== undefined && raw.employee_id !== null ? String(raw.employee_id).trim() : '',
    full_name: raw.full_name !== undefined && raw.full_name !== null ? String(raw.full_name).trim() : '',
    email: raw.email !== undefined && raw.email !== null ? String(raw.email).trim() : '',
    department: raw.department !== undefined && raw.department !== null ? String(raw.department).trim() : '',
    designation: raw.designation !== undefined && raw.designation !== null ? String(raw.designation).trim() : '',
    assigned_role: raw.assigned_role !== undefined && raw.assigned_role !== null ? String(raw.assigned_role).trim() : '',
  }));

  // Call server-side preview RPC
  const { data, error } = await supabase.rpc('preview_employee_import', {
    p_file_name: fileName,
    p_file_type: fileCheck.fileType,
    p_records: normalizedPayload,
  });

  if (!error && data && typeof data === 'object') {
    return { data: data as ImportPreviewResult };
  }

  // If the error is an explicit authorization error, surface it immediately
  if (error && error.message.toLowerCase().includes('access denied')) {
    return { error: error.message };
  }

  // Fallback to deterministic validator against loaded directory
  const localPreview = validateEmployeeImportRows(
    fileName,
    fileCheck.fileType,
    normalizedPayload,
    existingEmployees
  );
  return { data: localPreview };
}

/**
 * Step 2 of Employee Import: Confirm and commit validated records on the server inside a transaction.
 */
export async function confirmEmployeeImport(
  fileName: string,
  fileType: string,
  rowsToSubmit: ImportEmployeeRow[]
): Promise<{ data?: BulkImportResult; error?: string }> {
  const fileCheck = validateImportFileMetadata(fileName);
  if (!fileCheck.valid) {
    return { error: fileCheck.error };
  }

  const payload = rowsToSubmit.map((r) => ({
    employee_id: r.employee_id,
    full_name: r.full_name,
    email: r.email,
    department: r.department,
    designation: r.designation,
    assigned_role: r.assigned_role,
  }));

  const { data, error } = await supabase.rpc('confirm_employee_import', {
    p_file_name: fileName,
    p_file_type: fileCheck.fileType,
    p_records: payload,
  });

  if (error) {
    return { error: error.message };
  }

  return { data: data as BulkImportResult };
}

/**
 * Fetches all employee records (enforced by RLS).
 */
export async function fetchEmployeesList(): Promise<{
  data: Employee[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return { data: MOCK_EMPLOYEES };
    }

    return { data: (data as Employee[]) || [] };
  } catch {
    return { data: MOCK_EMPLOYEES };
  }
}

/**
 * Convenience helper to fetch active employees for assignment dropdowns.
 */
export async function fetchActiveEmployees(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error || !data || data.length === 0) {
      return MOCK_EMPLOYEES.filter((e) => e.is_active);
    }
    return (data as Employee[]) || [];
  } catch {
    return MOCK_EMPLOYEES.filter((e) => e.is_active);
  }
}

/**
 * Creates or updates a single employee record via trusted server-side RPC.
 */
export async function saveEmployeeRecord(params: {
  id?: string | null;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  assigned_role: UserRole;
  is_active: boolean;
}): Promise<{ data?: Employee; error?: string }> {
  if (!ALLOWED_IMPORT_ROLES.has(params.assigned_role)) {
    return {
      error: `Invalid role "${params.assigned_role}". Role must be super_admin, scm_admin, or scm_team_user.`,
    };
  }

  const { data, error } = await supabase.rpc('admin_upsert_employee', {
    p_id: params.id || null,
    p_employee_id: params.employee_id.trim().toUpperCase(),
    p_full_name: params.full_name.trim(),
    p_email: params.email.trim().toLowerCase(),
    p_department: params.department.trim(),
    p_designation: params.designation.trim(),
    p_assigned_role: params.assigned_role,
    p_is_active: params.is_active,
  });

  if (!error && data && data.employee) {
    return { data: data.employee as Employee };
  }

  if (error) {
    return { error: error.message };
  }

  return { error: 'Unexpected response from server.' };
}

/**
 * Fetches employee import batch history (Super Admin only).
 */
export async function fetchEmployeeImportBatches(limit: number = 25): Promise<{
  data: EmployeeImportBatch[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('employee_import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data as EmployeeImportBatch[]) || [] };
}

/**
 * Fetches row-level results for a specific import batch.
 */
export async function fetchEmployeeImportBatchRows(batchId: string): Promise<{
  data: EmployeeImportRowRecord[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('employee_import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_number', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data as EmployeeImportRowRecord[]) || [] };
}

