import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchProjectById,
  fetchProjectMilestones,
  upsertMilestone,
  archiveMilestone,
  fetchEligibleEmployees,
} from '@/services/projectService';
import { calculateMilestoneDelay } from '@/lib/projectCalculations';
import { Employee, Milestone, MilestoneStatus, Project } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Clock,
  ArrowLeft,
  Plus,
  Edit,
  Archive,
  AlertTriangle,
  Loader2,
  User,
  AlertCircle,
  X,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function ProjectMilestonesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Milestone Form Drawer/Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPlannedStart, setFormPlannedStart] = useState('');
  const [formPlannedEnd, setFormPlannedEnd] = useState('');
  const [formStatus, setFormStatus] = useState<MilestoneStatus>('draft');
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formActualCompletion, setFormActualCompletion] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const canCreate = hasPermission('milestones.create');
  const canUpdate = hasPermission('milestones.update');
  const canArchive = hasPermission('milestones.archive');
  const canAssign = hasPermission('milestones.assign');

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      const [projRes, mlsRes, empRes] = await Promise.all([
        fetchProjectById(projectId),
        fetchProjectMilestones(projectId),
        fetchEligibleEmployees(),
      ]);

      if (projRes.data) setProject(projRes.data);
      if (mlsRes.data) setMilestones(mlsRes.data);
      if (empRes.data) setEligibleEmployees(empRes.data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load milestones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const openCreateForm = () => {
    setEditingMilestone(null);
    setFormTitle('');
    setFormDesc('');

    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormPlannedStart(today);
    setFormPlannedEnd(end);
    setFormStatus('draft');
    setFormAssigneeId('');
    setFormActualCompletion('');
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditForm = (m: Milestone) => {
    setEditingMilestone(m);
    setFormTitle(m.title);
    setFormDesc(m.description || '');
    setFormPlannedStart(m.planned_start_date ? m.planned_start_date.split('T')[0] : '');
    setFormPlannedEnd(m.planned_end_date ? m.planned_end_date.split('T')[0] : '');
    setFormStatus(m.status);
    setFormAssigneeId(m.assignee_employee_id || '');
    setFormActualCompletion(m.actual_completion_date ? m.actual_completion_date.split('T')[0] : '');
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formTitle.trim()) {
      errors.title = 'Milestone title is required.';
    }
    if (!formPlannedStart) {
      errors.plannedStart = 'Planned start date is required.';
    }
    if (!formPlannedEnd) {
      errors.plannedEnd = 'Planned end date is required.';
    }
    if (formPlannedStart && formPlannedEnd && formPlannedEnd < formPlannedStart) {
      errors.plannedEnd = 'Planned end date cannot precede start date.';
    }
    if (formStatus === 'completed' && !formActualCompletion) {
      errors.actualCompletion = 'Completed milestones require an actual completion date.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !validateForm()) return;

    setSubmitting(true);
    const res = await upsertMilestone({
      id: editingMilestone?.id,
      project_id: projectId,
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      planned_start_date: formPlannedStart,
      planned_end_date: formPlannedEnd,
      status: formStatus,
      assignee_employee_id: formAssigneeId || undefined,
      actual_completion_date: formStatus === 'completed' ? formActualCompletion : undefined,
    });
    setSubmitting(false);

    if (res.error) {
      alert(`Milestone save error: ${res.error}`);
    } else {
      setIsFormOpen(false);
      loadData();
    }
  };

  const handleArchive = async (milestoneId: string, title: string) => {
    if (!projectId) return;
    const confirmed = window.confirm(`Archive milestone "${title}"? It will be removed from future calculations.`);
    if (!confirmed) return;

    const res = await archiveMilestone(milestoneId);
    if (res.error) {
      alert(`Failed to archive milestone: ${res.error}`);
    } else {
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  const isProjectArchived = project?.status === 'archived';

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-ink-secondary">
        <Link to="/app/projects" className="hover:text-forest flex items-center font-medium">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Projects
        </Link>
        <span className="text-divider">/</span>
        <Link to={`/app/projects/${projectId}`} className="hover:text-forest font-mono">
          {project?.project_code || 'Project'}
        </Link>
        <span className="text-divider">/</span>
        <span className="text-ink-primary font-semibold">Milestone Schedule</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
            <Clock className="h-6 w-6 text-forest" />
            <span>Milestones: {project?.name || project?.title}</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Work Breakdown Structure milestones, sequential target dates, and team member deliverable assignments.
          </p>
        </div>

        {canCreate && !isProjectArchived && (
          <Button onClick={openCreateForm} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Milestone
          </Button>
        )}
      </div>

      {/* Milestone Modal / Drawer Form */}
      {isFormOpen && (
        <Card className="border-sage bg-sage-pale/30 shadow-warm-md">
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-sage/40">
            <CardTitle className="text-sm font-semibold text-forest">
              {editingMilestone ? `Edit Milestone (${editingMilestone.milestone_code})` : 'Schedule New Milestone'}
            </CardTitle>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-ink-muted hover:text-forest p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <form onSubmit={handleFormSubmit}>
            <CardContent className="space-y-4 pt-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="mTitle" className="text-xs">Milestone Title <span className="text-status-danger">*</span></Label>
                <Input
                  id="mTitle"
                  type="text"
                  placeholder="e.g. Raw Material Assay Verification & COA Release"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="text-xs"
                  required
                />
                {formErrors.title && <p className="text-[11px] text-status-danger">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="mDesc" className="text-xs">Deliverable Description</Label>
                <textarea
                  id="mDesc"
                  rows={2}
                  placeholder="Specify protocol requirements or target deliverables..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded border border-divider p-2 text-xs bg-ivory-surface text-ink-primary focus:border-forest"
                />
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mStart" className="text-xs">Planned Start Date <span className="text-status-danger">*</span></Label>
                  <Input
                    id="mStart"
                    type="date"
                    value={formPlannedStart}
                    onChange={(e) => setFormPlannedStart(e.target.value)}
                    className="text-xs font-mono"
                    required
                  />
                  {formErrors.plannedStart && <p className="text-[11px] text-status-danger">{formErrors.plannedStart}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mEnd" className="text-xs">Planned End Date <span className="text-status-danger">*</span></Label>
                  <Input
                    id="mEnd"
                    type="date"
                    value={formPlannedEnd}
                    onChange={(e) => setFormPlannedEnd(e.target.value)}
                    className="text-xs font-mono"
                    required
                  />
                  {formErrors.plannedEnd && <p className="text-[11px] text-status-danger">{formErrors.plannedEnd}</p>}
                </div>
              </div>

              {/* Status and Assignee Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mStatus" className="text-xs">Status</Label>
                  <select
                    id="mStatus"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as MilestoneStatus)}
                    className="w-full h-9 rounded border border-divider px-2 text-xs bg-ivory-surface text-ink-primary focus:border-forest"
                  >
                    <option value="draft">Draft</option>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mAssignee" className="text-xs">Assigned Team Member</Label>
                  <select
                    id="mAssignee"
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    disabled={!canAssign && Boolean(editingMilestone?.assignee_employee_id)}
                    className="w-full h-9 rounded border border-divider px-2 text-xs bg-ivory-surface text-ink-primary font-mono focus:border-forest"
                  >
                    <option value="">Unassigned</option>
                    {eligibleEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id} • {emp.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actual Completion Date if Completed */}
              {formStatus === 'completed' && (
                <div className="space-y-1.5 p-3 rounded bg-sage-pale/50 border border-sage/60">
                  <Label htmlFor="mActual" className="text-xs font-semibold text-forest">
                    Actual Completion Date <span className="text-status-danger">*</span>
                  </Label>
                  <Input
                    id="mActual"
                    type="date"
                    value={formActualCompletion}
                    onChange={(e) => setFormActualCompletion(e.target.value)}
                    className="text-xs font-mono bg-ivory-surface"
                    required
                  />
                  {formErrors.actualCompletion && <p className="text-[11px] text-status-danger">{formErrors.actualCompletion}</p>}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-sage/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="text-xs">
                  {submitting ? 'Saving...' : editingMilestone ? 'Update Milestone' : 'Save Milestone'}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Milestones Table */}
      <div className="rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Milestone Code</TableHead>
              <TableHead>Title & Deliverables</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Planned Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delay Telemetry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-xs text-ink-secondary">
                  <Clock className="h-8 w-8 text-sage/70 mx-auto mb-2" />
                  <p className="font-semibold text-ink-primary">No Milestones Scheduled</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Projects remain valid and functional without milestones.</p>
                </TableCell>
              </TableRow>
            ) : (
              milestones.map((m) => {
                const delay = calculateMilestoneDelay(m.planned_end_date, m.actual_completion_date, m.status);
                const isArchived = m.status === 'archived';

                return (
                  <TableRow key={m.id} className={isArchived ? 'opacity-60 bg-ivory/50' : 'hover:bg-sage-pale/20 transition-colors'}>
                    {/* Code */}
                    <TableCell className="font-mono text-xs font-bold text-forest">
                      {m.milestone_code}
                    </TableCell>

                    {/* Title */}
                    <TableCell>
                      <span className="font-semibold text-xs text-ink-primary block">
                        {m.title}
                      </span>
                      {m.description && (
                        <span className="text-[11px] text-ink-secondary block truncate max-w-xs mt-0.5">
                          {m.description}
                        </span>
                      )}
                    </TableCell>

                    {/* Assignee */}
                    <TableCell className="text-xs text-ink-secondary">
                      {m.assignee ? (
                        <div className="flex items-center space-x-1.5">
                          <User className="h-3 w-3 text-ink-muted shrink-0" />
                          <span className="truncate max-w-[120px]">{m.assignee.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-ink-muted font-mono text-[11px]">Unassigned</span>
                      )}
                    </TableCell>

                    {/* Planned Schedule */}
                    <TableCell className="text-xs font-mono text-ink-secondary whitespace-nowrap">
                      <div>{formatDateIST(m.planned_start_date)}</div>
                      <div className="text-[11px] text-ink-muted">to {formatDateIST(m.planned_end_date)}</div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge variant={m.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px] uppercase">
                        {m.status}
                      </Badge>
                    </TableCell>

                    {/* Delay */}
                    <TableCell>
                      {delay.isLateOrOverdue ? (
                        <span className="inline-flex items-center text-[11px] font-mono font-medium text-copper-dark bg-copper-pale/60 px-2 py-0.5 rounded border border-copper/30">
                          <AlertTriangle className="h-3 w-3 mr-1 text-copper" />
                          {delay.displayText}
                        </span>
                      ) : (
                        <span className="text-ink-secondary text-[11px] font-mono">
                          {delay.displayText}
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {!isArchived && !isProjectArchived && (
                        <div className="flex items-center justify-end space-x-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditForm(m)}
                              className="h-7 px-2 text-xs text-forest hover:text-forest-deep"
                              title="Edit Milestone"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {canArchive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(m.id, m.title)}
                              className="h-7 px-2 text-xs text-copper hover:text-copper-dark"
                              title="Archive Milestone"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
