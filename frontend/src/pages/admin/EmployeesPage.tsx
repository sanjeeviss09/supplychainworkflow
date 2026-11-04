import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Employee,
  UserRole,
  ImportEmployeeRow,
  BulkImportResult,
  EmployeeImportBatch,
  EmployeeImportRowRecord,
} from '@/types/database.types';
import {
  confirmEmployeeImport,
  fetchEmployeeImportBatches,
  fetchEmployeeImportBatchRows,
  fetchEmployeesList,
  previewEmployeeImport,
  saveEmployeeRecord,
  validateImportFileMetadata,
} from '@/services/employeeService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit2,
  UserX,
  UserCheck,
  FileText,
  History,
  MinusCircle,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState<'directory' | 'import_history'>('directory');

  // Import History State
  const [importBatches, setImportBatches] = useState<EmployeeImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<EmployeeImportBatch | null>(null);
  const [batchRows, setBatchRows] = useState<EmployeeImportRowRecord[]>([]);
  const [loadingBatchRows, setLoadingBatchRows] = useState(false);

  // Edit / Create Single Employee Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('scm_team_user');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editDept, setEditDept] = useState<string>('');
  const [editDesig, setEditDesig] = useState<string>('');
  const [editFullName, setEditFullName] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isAddMode, setIsAddMode] = useState(false);
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Bulk Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileType, setUploadedFileType] = useState<string>('csv');
  const [parsedRows, setParsedRows] = useState<ImportEmployeeRow[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<BulkImportResult | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);

  const loadEmployees = async () => {
    setLoading(true);
    const { data, error } = await fetchEmployeesList();
    if (!error) {
      setEmployees(data);
    }
    setLoading(false);
  };

  const loadImportHistory = async () => {
    setLoadingBatches(true);
    const { data, error } = await fetchEmployeeImportBatches();
    if (!error) {
      setImportBatches(data);
    }
    setLoadingBatches(false);
  };

  const handleInspectBatch = async (batch: EmployeeImportBatch) => {
    setSelectedBatch(batch);
    setLoadingBatchRows(true);
    const { data } = await fetchEmployeeImportBatchRows(batch.id);
    setBatchRows(data);
    setLoadingBatchRows(false);
  };

  useEffect(() => {
    loadEmployees();
    loadImportHistory();
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      emp.employee_id.toLowerCase().includes(q) ||
      emp.full_name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q) ||
      emp.designation.toLowerCase().includes(q);

    const matchesRole = roleFilter === 'all' || emp.assigned_role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && emp.is_active) ||
      (statusFilter === 'inactive' && !emp.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setIsAddMode(false);
    setEditFullName(emp.full_name);
    setEditRole(emp.assigned_role);
    setEditActive(emp.is_active);
    setEditDept(emp.department);
    setEditDesig(emp.designation);
    setEditError(null);
    setEditDialogOpen(true);
  };

  const handleOpenAdd = () => {
    setSelectedEmp(null);
    setIsAddMode(true);
    setNewEmpId('');
    setNewEmail('');
    setEditFullName('');
    setEditRole('scm_team_user');
    setEditActive(true);
    setEditDept('Supply Chain Management');
    setEditDesig('SCM Analyst');
    setEditError(null);
    setEditDialogOpen(true);
  };

  const handleSaveEmployee = async () => {
    setEditError(null);
    setIsSavingEdit(true);

    const result = await saveEmployeeRecord({
      id: isAddMode ? null : selectedEmp?.id,
      employee_id: isAddMode ? newEmpId : selectedEmp?.employee_id || '',
      email: isAddMode ? newEmail : selectedEmp?.email || '',
      full_name: editFullName,
      department: editDept,
      designation: editDesig,
      assigned_role: editRole,
      is_active: editActive,
    });

    setIsSavingEdit(false);

    if (result.error) {
      setEditError(result.error);
      return;
    }

    setEditDialogOpen(false);
    await loadEmployees();
  };

  const handleToggleStatus = async (emp: Employee) => {
    const updatedStatus = !emp.is_active;
    const result = await saveEmployeeRecord({
      id: emp.id,
      employee_id: emp.employee_id,
      email: emp.email,
      full_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_role: emp.assigned_role,
      is_active: updatedStatus,
    });

    if (!result.error) {
      await loadEmployees();
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'employee_id,full_name,email,department,designation,assigned_role\n' +
      'EMP-2001,Rajesh Sharma,rajesh.sharma@company.internal,Supply Chain Management,SCM Executive,scm_team_user\n' +
      'EMP-2002,Priya Nair,priya.nair@company.internal,Quality Assurance,QA Lead,scm_admin\n' +
      'EMP-2003,Amit Verma,amit.verma@company.internal,Formulations,Plant Operations,scm_team_user\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'scm_employees_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Parses the uploaded CSV file and invokes server-side validation & preview.
   * Does NOT silently assign a default role when role is missing or invalid.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileError(null);
    const metaCheck = validateImportFileMetadata(file.name, file.size);
    if (!metaCheck.valid) {
      setImportFileError(metaCheck.error || 'Invalid file.');
      return;
    }

    setUploadedFileName(file.name);
    setUploadedFileType(metaCheck.fileType);
    setIsPreviewLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (!results.data || results.data.length === 0) {
          setIsPreviewLoading(false);
          setImportFileError('The uploaded file contains no employee records.');
          return;
        }

        const previewResp = await previewEmployeeImport(
          file.name,
          metaCheck.fileType,
          results.data as Array<Record<string, any>>,
          employees
        );

        setIsPreviewLoading(false);

        if (previewResp.error || !previewResp.data) {
          setImportFileError(previewResp.error || 'Failed to validate import rows.');
          return;
        }

        setParsedRows(previewResp.data.rows);
        setImportStep(2);
      },
      error: (err) => {
        setIsPreviewLoading(false);
        setImportFileError(`Failed to parse file: ${err.message}`);
      },
    });
  };

  /**
   * Executes the confirmed transactional import on the server.
   */
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setImportFileError(null);

    const confirmResp = await confirmEmployeeImport(
      uploadedFileName,
      uploadedFileType,
      parsedRows
    );

    setIsImporting(false);

    if (confirmResp.error || !confirmResp.data) {
      setImportFileError(confirmResp.error || 'Import operation failed.');
      return;
    }

    setImportSummary(confirmResp.data);
    setImportStep(3);
    await loadEmployees();
    await loadImportHistory();
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'super_admin':
        return <Badge variant="super_admin">Super Admin</Badge>;
      case 'scm_admin':
        return <Badge variant="scm_admin">SCM Admin</Badge>;
      case 'scm_team_user':
      default:
        return <Badge variant="scm_team_user">SCM Team</Badge>;
    }
  };

  const acceptedRowsCount = parsedRows.filter(
    (r) => r.outcome === 'accepted_insert' || r.outcome === 'accepted_update'
  ).length;
  const skippedRowsCount = parsedRows.filter((r) => r.outcome === 'skipped').length;
  const rejectedRowsCount = parsedRows.filter((r) => r.outcome === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2.5">
            <Users className="h-6 w-6 text-forest" />
            <span>Employee Access Directory</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Authoritative corporate directory governing authentication, role assignments, and database access policies.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={activeView === 'import_history' ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              setActiveView(activeView === 'directory' ? 'import_history' : 'directory')
            }
            className="text-xs"
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            {activeView === 'directory' ? 'Import History' : 'Back to Directory'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="text-xs"
            title="Download CSV format"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportStep(1);
              setParsedRows([]);
              setImportSummary(null);
              setImportFileError(null);
              setImportModalOpen(true);
            }}
            className="text-xs border-sage text-forest hover:bg-sage-pale/60"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import List
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="text-xs font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Directory Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-divider bg-ivory-surface p-3 shadow-warm-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Total Enrolled
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-forest">
            {employees.length}
          </p>
        </div>
        <div className="rounded-xl border border-divider bg-ivory-surface p-3 shadow-warm-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-status-success">
            Active Accounts
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-status-success">
            {employees.filter((e) => e.is_active).length}
          </p>
        </div>
        <div className="rounded-xl border border-divider bg-ivory-surface p-3 shadow-warm-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-forest">
            SCM Admins
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-forest">
            {employees.filter((e) => e.assigned_role === 'scm_admin').length}
          </p>
        </div>
        <div className="rounded-xl border border-divider bg-ivory-surface p-3 shadow-warm-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-copper">
            Import Batches
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-copper-dark">
            {importBatches.length}
          </p>
        </div>
      </div>

      {activeView === 'directory' ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-xl border border-divider bg-ivory-surface p-3 shadow-warm-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by Employee ID, Name, Email, Department or Role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:border-forest"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="scm_admin">SCM Admin</option>
                <option value="scm_team_user">SCM Team</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:border-forest"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Main Employee Table */}
          <div className="rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Work Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-forest" />
                      Loading directory records...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-ink-secondary">
                      No employee records found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-sage-pale/20 transition-colors">
                      <TableCell className="font-mono font-bold text-xs text-forest">
                        {emp.employee_id}
                      </TableCell>
                      <TableCell className="font-medium text-xs text-slate-900 dark:text-white">
                        {emp.full_name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                        {emp.email}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {emp.department}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {emp.designation}
                      </TableCell>
                      <TableCell>{getRoleBadge(emp.assigned_role)}</TableCell>
                      <TableCell>
                        {emp.is_active ? (
                          <span className="inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5"></span>
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(emp)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Edit Details & Role"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(emp)}
                            className={`h-8 w-8 p-0 ${
                              emp.is_active
                                ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={emp.is_active ? 'Deactivate Employee' : 'Activate Employee'}
                          >
                            {emp.is_active ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        /* Import History View */
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date (IST)</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Total Rows</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Row Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingBatches ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-blue-600" />
                      Loading import history...
                    </TableCell>
                  </TableRow>
                ) : importBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-xs text-slate-500">
                      No employee import batches have been executed yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  importBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="text-xs font-mono">
                        {formatDateIST(batch.created_at)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{batch.file_name}</TableCell>
                      <TableCell className="text-xs font-mono">{batch.total_rows}</TableCell>
                      <TableCell className="text-xs font-mono text-emerald-600 font-semibold">
                        {batch.accepted_rows}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {batch.skipped_rows}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-rose-600 font-semibold">
                        {batch.rejected_rows}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" className="text-[10px]">
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInspectBatch(batch)}
                          className="text-xs h-7"
                        >
                          View Rows
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {selectedBatch && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Row-Level Outcomes for Batch: {selectedBatch.file_name}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBatch(null)}
                  className="text-xs h-7"
                >
                  Close
                </Button>
              </div>
              <div className="max-h-64 overflow-auto border border-slate-200 dark:border-slate-800 rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingBatchRows ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-20 text-center text-xs">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      batchRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">
                            {r.employee_id || '—'}
                          </TableCell>
                          <TableCell className="text-xs">{r.full_name || '—'}</TableCell>
                          <TableCell className="text-xs">{r.email || '—'}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {r.assigned_role || '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant={
                                r.outcome.startsWith('accepted')
                                  ? 'success'
                                  : r.outcome === 'skipped'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {r.outcome}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {r.error_message || 'Processed'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit / Add Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAddMode ? 'Add New Employee Record' : `Edit Employee: ${selectedEmp?.employee_id}`}
            </DialogTitle>
            <DialogDescription>
              {isAddMode
                ? 'Create a pre-approved employee record enabling the individual to self-register.'
                : 'Modify assigned role or active authorization status via trusted server-side RPC.'}
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 py-2 text-xs">
            {isAddMode && (
              <>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Employee ID
                  </label>
                  <Input
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    placeholder="e.g. EMP-2045"
                    className="h-9 uppercase font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Work Email
                  </label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@company.internal"
                    className="h-9"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Full Legal Name"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Department
                </label>
                <Input
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  placeholder="Department"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Designation
                </label>
                <Input
                  value={editDesig}
                  onChange={(e) => setEditDesig(e.target.value)}
                  placeholder="Designation"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Assigned Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="scm_team_user">SCM Team User (Standard Operational)</option>
                <option value="scm_admin">SCM Admin (SCM Governance & PO Sign-off)</option>
                <option value="super_admin">
                  Super Admin (System Control & Employee Access)
                </option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="editActiveStatus"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="editActiveStatus"
                className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Employee is active (Unchecking immediately blocks login and revokes RLS access)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEmployee}
              disabled={isSavingEdit}
              className="font-semibold"
            >
              {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {isAddMode ? 'Create Record' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk CSV Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-forest" />
              <span>Import Approved Employee List</span>
            </DialogTitle>
            <DialogDescription>
              Batch provision authorized employee access. Missing or invalid roles are strictly rejected and never defaulted.
            </DialogDescription>
          </DialogHeader>

          {importFileError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{importFileError}</AlertDescription>
            </Alert>
          )}

          {/* Wizard Step 1: Upload */}
          {importStep === 1 && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed border-divider rounded-xl p-6 text-center hover:border-forest transition-colors bg-ivory/40">
                <FileText className="h-10 w-10 text-sage mx-auto mb-2" />
                <p className="text-xs font-semibold text-ink-primary">
                  Select corporate employee CSV file
                </p>
                <p className="text-[11px] text-ink-secondary mt-1">
                  Required columns:{' '}
                  <code className="text-forest font-semibold">
                    employee_id, full_name, email, department, designation, assigned_role
                  </code>
                </p>

                <div className="mt-4">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-forest px-4 py-2 text-xs font-semibold text-ivory-surface hover:bg-forest-deep transition-colors shadow-warm-sm">
                    {isPreviewLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        <span>Validating File...</span>
                      </>
                    ) : (
                      <span>Browse File (.csv)</span>
                    )}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      disabled={isPreviewLoading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>Need reference structure?</span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-blue-600 hover:underline flex items-center"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download CSV Template
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 2: Preview & Validation Table */}
          {importStep === 2 && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    File: {uploadedFileName} ({parsedRows.length} Rows)
                  </span>
                  <span className="text-emerald-600 font-medium">
                    {acceptedRowsCount} Accepted
                  </span>
                  <span className="text-slate-500 font-medium">
                    {skippedRowsCount} Skipped (Unchanged)
                  </span>
                  <span className="text-rose-600 font-medium">
                    {rejectedRowsCount} Rejected
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportStep(1)}
                  className="text-xs h-7"
                >
                  Choose Different File
                </Button>
              </div>

              <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-md max-h-60 text-xs">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={
                          row.outcome === 'rejected'
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : row.outcome === 'skipped'
                            ? 'bg-slate-50/60 dark:bg-slate-900/40'
                            : ''
                        }
                      >
                        <TableCell className="font-mono text-[11px] text-slate-400">
                          {row.row_number || idx + 1}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-xs">
                          {row.employee_id || '—'}
                        </TableCell>
                        <TableCell>{row.full_name || '—'}</TableCell>
                        <TableCell>{row.email || '—'}</TableCell>
                        <TableCell className="font-mono">{row.assigned_role || 'MISSING'}</TableCell>
                        <TableCell>
                          {row.outcome === 'accepted_insert' && (
                            <span className="text-emerald-600 text-[11px] flex items-center font-medium">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Accepted (New)
                            </span>
                          )}
                          {row.outcome === 'accepted_update' && (
                            <span className="text-blue-600 text-[11px] flex items-center font-medium">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Accepted (Update)
                            </span>
                          )}
                          {row.outcome === 'skipped' && (
                            <span className="text-slate-500 text-[11px] flex items-center">
                              <MinusCircle className="h-3 w-3 mr-1" />
                              Skipped (Unchanged)
                            </span>
                          )}
                          {row.outcome === 'rejected' && (
                            <span className="text-rose-600 text-[11px] flex items-center font-medium">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Rejected: {row.error}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Success Summary */}
          {importStep === 3 && importSummary && (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Import Batch Recorded & Completed
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Employee records and row-level import outcomes have been committed to the database and logged in the immutable security audit trail.
              </p>

              <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block">Total Rows</span>
                  <span className="font-bold text-base">{importSummary.total}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded border border-emerald-200 dark:border-emerald-800">
                  <span className="text-emerald-700 dark:text-emerald-300 block">
                    Accepted
                  </span>
                  <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                    {(importSummary.inserted || 0) + (importSummary.updated || 0)}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-300 block">Skipped</span>
                  <span className="font-bold text-base text-slate-700 dark:text-slate-200">
                    {importSummary.skipped || 0}
                  </span>
                </div>
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 rounded border border-rose-200 dark:border-rose-800">
                  <span className="text-rose-700 dark:text-rose-300 block">Rejected</span>
                  <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                    {importSummary.failed || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            {importStep === 2 && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecuteImport}
                  disabled={isImporting || acceptedRowsCount === 0}
                  className="font-semibold"
                >
                  {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Confirm & Commit Import ({acceptedRowsCount} Accepted)
                </Button>
              </>
            )}
            {importStep === 3 && (
              <Button
                size="sm"
                onClick={() => setImportModalOpen(false)}
                className="w-full font-semibold"
              >
                Close & View Directory
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
