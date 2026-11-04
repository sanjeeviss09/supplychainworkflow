import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { createProject, fetchDepartmentsList, fetchEligibleEmployees } from '@/services/projectService';
import { Department, Employee } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FolderPlus, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export function ProjectCreatePage() {
  const { employee } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Set default planned dates (today and +30 days)
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 30);

    setPlannedStartDate(today.toISOString().split('T')[0]);
    setPlannedEndDate(end.toISOString().split('T')[0]);

    // Load departments
    fetchDepartmentsList().then((res) => {
      if (res.data && res.data.length > 0) {
        setDepartments(res.data);
        // Pre-select user's department if matching
        const match = res.data.find(
          (d) => employee?.department && d.name.toLowerCase() === employee.department.toLowerCase()
        );
        if (match) {
          setDepartmentId(match.id);
        } else {
          setDepartmentId(res.data[0].id);
        }
      }
    });

    // Load active employees
    fetchEligibleEmployees().then((res) => {
      if (res.data && res.data.length > 0) {
        setEligibleEmployees(res.data);
        // Pre-select current employee as default owner
        if (employee) {
          const current = res.data.find((e) => e.id === employee.id);
          if (current) setOwnerEmployeeId(current.id);
          else setOwnerEmployeeId(res.data[0].id);
        } else {
          setOwnerEmployeeId(res.data[0].id);
        }
      }
    });
  }, [employee]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Project name is required and cannot be empty.';
    }

    if (!departmentId) {
      errors.departmentId = 'Department selection is required.';
    }

    if (!ownerEmployeeId) {
      errors.ownerEmployeeId = 'Project owner must be assigned.';
    }

    if (!plannedStartDate) {
      errors.plannedStartDate = 'Planned start date is required.';
    }

    if (!plannedEndDate) {
      errors.plannedEndDate = 'Planned end date is required.';
    }

    if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
      errors.plannedEndDate = 'Planned end date cannot precede planned start date.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const res = await createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      department_id: departmentId,
      owner_employee_id: ownerEmployeeId,
      planned_start_date: plannedStartDate,
      planned_end_date: plannedEndDate,
    });
    setIsSubmitting(false);

    if (res.error) {
      setServerError(res.error);
    } else if (res.data) {
      navigate(`/app/projects/${res.data.id}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-ink-secondary">
        <Link to="/app/projects" className="hover:text-forest flex items-center font-medium">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Projects
        </Link>
        <span className="text-divider">/</span>
        <span className="text-ink-primary font-semibold">New Project</span>
      </div>

      <Card className="border border-divider bg-ivory-surface shadow-warm-md">
        <CardHeader className="border-b border-divider/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-sage font-bold shadow-xs">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-forest">
                  Create New Project
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Initialize a new SCM project with unique server-generated code and departmental allocation.
                </CardDescription>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-forest bg-sage-pale px-2.5 py-1 rounded-full border border-sage/50 font-medium">
              <ShieldCheck className="h-4 w-4 text-status-success" />
              <span>Initial State: Draft</span>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            {serverError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium">{serverError}</AlertDescription>
              </Alert>
            )}

            {/* Project Name */}
            <div className="space-y-1.5">
              <Label htmlFor="projectName">
                Project Name <span className="text-status-danger">*</span>
              </Label>
              <Input
                id="projectName"
                type="text"
                placeholder="e.g. Paracetamol Synthesis Batch 2026-Q1"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                }}
                disabled={isSubmitting}
                className={fieldErrors.name ? 'border-status-danger text-xs' : 'text-xs'}
                required
              />
              {fieldErrors.name && (
                <p className="text-[11px] text-status-danger font-medium">{fieldErrors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Project Description & Scope</Label>
              <textarea
                id="description"
                rows={3}
                placeholder="Provide work breakdown objectives, regulatory context, or target batch requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-divider bg-ivory-surface p-2.5 text-xs text-ink-primary placeholder:text-ink-muted/70 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-colors"
              />
            </div>

            {/* Department & Owner Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="department">
                  Department / Manufacturing Unit <span className="text-status-danger">*</span>
                </Label>
                <select
                  id="department"
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    if (fieldErrors.departmentId) setFieldErrors({ ...fieldErrors, departmentId: '' });
                  }}
                  disabled={isSubmitting}
                  className="w-full h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
                {fieldErrors.departmentId && (
                  <p className="text-[11px] text-status-danger font-medium">{fieldErrors.departmentId}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner">
                  Authoritative Project Owner <span className="text-status-danger">*</span>
                </Label>
                <select
                  id="owner"
                  value={ownerEmployeeId}
                  onChange={(e) => {
                    setOwnerEmployeeId(e.target.value);
                    if (fieldErrors.ownerEmployeeId) setFieldErrors({ ...fieldErrors, ownerEmployeeId: '' });
                  }}
                  disabled={isSubmitting}
                  className="w-full h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary font-mono focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                >
                  {eligibleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id} • {emp.department})
                    </option>
                  ))}
                </select>
                {fieldErrors.ownerEmployeeId && (
                  <p className="text-[11px] text-status-danger font-medium">{fieldErrors.ownerEmployeeId}</p>
                )}
              </div>
            </div>

            {/* Planned Start & End Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="plannedStartDate">
                  Planned Start Date <span className="text-status-danger">*</span>
                </Label>
                <Input
                  id="plannedStartDate"
                  type="date"
                  value={plannedStartDate}
                  onChange={(e) => {
                    setPlannedStartDate(e.target.value);
                    if (fieldErrors.plannedStartDate) setFieldErrors({ ...fieldErrors, plannedStartDate: '' });
                  }}
                  disabled={isSubmitting}
                  className="text-xs font-mono"
                  required
                />
                {fieldErrors.plannedStartDate && (
                  <p className="text-[11px] text-status-danger font-medium">{fieldErrors.plannedStartDate}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plannedEndDate">
                  Planned End Date <span className="text-status-danger">*</span>
                </Label>
                <Input
                  id="plannedEndDate"
                  type="date"
                  value={plannedEndDate}
                  onChange={(e) => {
                    setPlannedEndDate(e.target.value);
                    if (fieldErrors.plannedEndDate) setFieldErrors({ ...fieldErrors, plannedEndDate: '' });
                  }}
                  disabled={isSubmitting}
                  className="text-xs font-mono"
                  required
                />
                {fieldErrors.plannedEndDate && (
                  <p className="text-[11px] text-status-danger font-medium">{fieldErrors.plannedEndDate}</p>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-divider/60 pt-4 flex items-center justify-between">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to="/app/projects">Cancel</Link>
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Generating Project & Verifying Scope...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
