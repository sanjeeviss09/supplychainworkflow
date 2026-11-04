import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchProjectById,
  fetchProjectMembers,
  fetchProjectMilestones,
  addProjectMember,
  removeProjectMember,
  changeProjectOwner,
  archiveProject,
  fetchEligibleEmployees,
} from '@/services/projectService';
import { fetchAuditLogs } from '@/services/auditService';
import { calculateProjectDelay, calculateProjectProgress } from '@/lib/projectCalculations';
import { AuditLog, Employee, Milestone, Project, ProjectMember } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  FolderKanban,
  ArrowLeft,
  Edit,
  Archive,
  Users,
  CheckCircle2,
  Clock,
  Building,
  User,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditLog[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'members' | 'activity'>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals / Dropdowns for Owner and Member Management
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [selectedNewMember, setSelectedNewMember] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showChangeOwner, setShowChangeOwner] = useState(false);

  const canUpdate = hasPermission('projects.update');
  const canArchive = hasPermission('projects.archive');
  const canManageOwner = hasPermission('projects.manage_owner');
  const canManageMembers = hasPermission('projects.manage_members');
  const canCreateMilestone = hasPermission('milestones.create');

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      const [projRes, memRes, mlsRes] = await Promise.all([
        fetchProjectById(projectId),
        fetchProjectMembers(projectId),
        fetchProjectMilestones(projectId),
      ]);

      if (projRes.error) {
        setErrorMsg(projRes.error);
      } else if (projRes.data) {
        setProject(projRes.data);
      }

      if (memRes.data) setMembers(memRes.data);
      if (mlsRes.data) setMilestones(mlsRes.data);

      // Load employees for assignment
      fetchEligibleEmployees().then((res) => {
        if (res.data) setEligibleEmployees(res.data);
      });

      // Load project audit events
      fetchAuditLogs(50).then((res) => {
        if (res.data) {
          const filtered = res.data.filter((log) => log.record_id === projectId);
          setAuditEvents(filtered);
        }
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleArchive = async () => {
    if (!projectId || !project) return;
    const confirmed = window.confirm(
      `Are you sure you want to archive project "${project.project_code}: ${project.name}"? Archived projects become read-only while preserving all milestone and member history.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    const res = await archiveProject(projectId, 'Archived by authorized user from project detail');
    setActionLoading(false);

    if (res.error) {
      alert(`Archive failed: ${res.error}`);
    } else {
      loadData();
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedNewMember) return;

    setActionLoading(true);
    const res = await addProjectMember(projectId, selectedNewMember);
    setActionLoading(false);

    if (res.error) {
      alert(`Failed to add member: ${res.error}`);
    } else {
      setShowAddMember(false);
      setSelectedNewMember('');
      loadData();
    }
  };

  const handleRemoveMember = async (employeeId: string, memberName: string) => {
    if (!projectId) return;
    const confirmed = window.confirm(
      `Remove ${memberName} from this project? Their project scope will be revoked immediately while preserving membership history.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    const res = await removeProjectMember(projectId, employeeId);
    setActionLoading(false);

    if (res.error) {
      alert(`Failed to remove member: ${res.error}`);
    } else {
      loadData();
    }
  };

  const handleChangeOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedNewOwner) return;

    setActionLoading(true);
    const res = await changeProjectOwner(projectId, selectedNewOwner);
    setActionLoading(false);

    if (res.error) {
      alert(`Failed to reassign owner: ${res.error}`);
    } else {
      setShowChangeOwner(false);
      setSelectedNewOwner('');
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

  if (errorMsg || !project) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link to="/app/projects">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Projects
          </Link>
        </Button>
        <div className="rounded-xl border border-red-300 bg-rose-50 p-6 text-center text-xs text-status-danger shadow-warm-sm">
          <AlertCircle className="h-6 w-6 text-status-danger mx-auto mb-2" />
          <h3 className="font-semibold text-sm">Unable to Load Project</h3>
          <p className="mt-1 text-[11px]">
            {errorMsg || 'Project not found or access denied by departmental scope.'}
          </p>
        </div>
      </div>
    );
  }

  const delay = calculateProjectDelay(project.planned_end_date, project.actual_completion_date, project.status);
  const progress = calculateProjectProgress(milestones);
  const isArchived = project.status === 'archived';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2 text-xs text-ink-secondary">
          <Link to="/app/projects" className="hover:text-forest flex items-center font-medium">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Projects
          </Link>
          <span className="text-divider">/</span>
          <span className="font-mono text-ink-primary font-semibold">{project.project_code}</span>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {canUpdate && !isArchived && (
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to={`/app/projects/${project.id}/edit`}>
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit Project
              </Link>
            </Button>
          )}

          {canArchive && !isArchived && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleArchive}
              disabled={actionLoading}
              className="text-xs text-copper-dark hover:border-copper/40 hover:bg-copper-pale/40"
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Hero Project Summary Header Card */}
      <div className="rounded-xl border border-divider bg-ivory-surface p-5 sm:p-6 shadow-warm-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="font-mono text-xs font-bold text-forest bg-sage-pale px-2.5 py-0.5 rounded border border-sage/50">
                {project.project_code}
              </span>
              <Badge variant={project.status === 'active' ? 'success' : 'outline'} className="capitalize">
                {project.status.replace(/_/g, ' ')}
              </Badge>
              {isArchived && (
                <Badge variant="destructive" className="text-[10px]">Read-Only Archive</Badge>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest mt-2">
              {project.name || project.title}
            </h1>

            {project.description && (
              <p className="text-xs text-ink-secondary mt-1.5 max-w-3xl leading-relaxed">
                {project.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
              <div className="flex items-center space-x-1.5">
                <Building className="h-3.5 w-3.5 text-ink-muted" />
                <span>Department: <strong className="text-ink-primary">{project.department?.name || 'Unassigned'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <User className="h-3.5 w-3.5 text-ink-muted" />
                <span>Owner: <strong className="text-ink-primary">{project.owner?.full_name || 'Owner Unassigned'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                <span className="font-mono">
                  {formatDateIST(project.planned_start_date)} — {formatDateIST(project.planned_end_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Progress & Delay Telemetry Box */}
          <div className="rounded-lg border border-divider bg-ivory p-4 text-right min-w-[200px]">
            <span className="text-[10px] text-ink-secondary uppercase tracking-wider block font-semibold">
              Milestone Progress
            </span>
            <div className="text-lg font-bold font-mono text-forest mt-0.5">
              {progress.displayLabel}
            </div>
            <div className="mt-2 text-[11px] font-mono">
              {delay.isLateOrOverdue ? (
                <span className="text-copper-dark font-semibold inline-flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1 text-copper" />
                  {delay.displayText}
                </span>
              ) : (
                <span className="text-ink-secondary">
                  {delay.displayText}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-divider">
        <nav className="flex space-x-6 text-xs font-medium">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'milestones', label: `Milestones (${milestones.length})` },
            { id: 'members', label: `Team Members (${members.filter((m) => m.status === 'active').length})` },
            { id: 'activity', label: 'Activity & Audit History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-forest text-forest font-semibold'
                  : 'border-transparent text-ink-secondary hover:text-forest'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-semibold text-forest">Project Parameters & Concurrency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs pt-4">
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Project Code</span>
                <span className="font-mono font-bold text-forest">{project.project_code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Status</span>
                <span className="capitalize font-medium text-ink-primary">{project.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Planned Start Date</span>
                <span className="font-mono text-ink-primary">{formatDateIST(project.planned_start_date)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Planned End Date</span>
                <span className="font-mono text-ink-primary">{formatDateIST(project.planned_end_date)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Actual Completion Date</span>
                <span className="font-mono text-ink-primary">{project.actual_completion_date ? formatDateIST(project.actual_completion_date) : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Version / Concurrency Counter</span>
                <span className="font-mono font-semibold text-forest">v{project.version}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-semibold text-forest">Governance & Authoritative Ownership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs pt-4">
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Department / Unit</span>
                <span className="font-semibold text-ink-primary">{project.department?.name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-divider/50">
                <span className="text-ink-secondary">Authoritative Owner</span>
                <div className="text-right">
                  <span className="font-semibold text-ink-primary block">{project.owner?.full_name || 'Unassigned'}</span>
                  <span className="font-mono text-[11px] text-ink-secondary">{project.owner?.employee_id}</span>
                </div>
              </div>

              {canManageOwner && !isArchived && (
                <div className="pt-2">
                  {!showChangeOwner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChangeOwner(true)}
                      className="text-xs w-full"
                    >
                      Reassign Authoritative Owner
                    </Button>
                  ) : (
                    <form onSubmit={handleChangeOwner} className="space-y-2 p-3 bg-ivory rounded-lg border border-divider">
                      <Label htmlFor="newOwnerSelect" className="text-xs">Select New Owner</Label>
                      <select
                        id="newOwnerSelect"
                        value={selectedNewOwner}
                        onChange={(e) => setSelectedNewOwner(e.target.value)}
                        className="w-full h-8 rounded border border-divider text-xs bg-ivory-surface px-2 font-mono text-ink-primary focus:border-forest"
                        required
                      >
                        <option value="">Choose an active employee...</option>
                        {eligibleEmployees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name} ({e.employee_id} • {e.department})
                          </option>
                        ))}
                      </select>
                      <div className="flex justify-end space-x-2 pt-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangeOwner(false)} className="text-xs">
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={actionLoading || !selectedNewOwner} className="text-xs">
                          Confirm Reassignment
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: MILESTONES */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-forest">
              Project Milestones (WBS)
            </h3>
            <div className="flex items-center space-x-2">
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to={`/app/projects/${project.id}/milestones`}>
                  Manage Milestones View
                </Link>
              </Button>
            </div>
          </div>

          {milestones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-divider bg-ivory-surface p-8 text-center text-xs text-ink-secondary">
              <Clock className="h-6 w-6 text-sage mx-auto mb-2" />
              <p className="font-semibold text-ink-primary">No milestones scheduled</p>
              <p className="text-[11px] text-ink-muted mt-0.5">This project is valid with no milestones.</p>
              {canCreateMilestone && !isArchived && (
                <Button asChild size="sm" variant="outline" className="mt-3 text-xs">
                  <Link to={`/app/projects/${project.id}/milestones`}>
                    <Plus className="h-3 w-3 mr-1" />
                    Schedule First Milestone
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-divider/60 rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
              {milestones.map((m) => {
                const mDelay = calculateProjectDelay(m.planned_end_date, m.actual_completion_date, m.status);
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between text-xs hover:bg-sage-pale/20 transition-colors">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-forest">{m.milestone_code}</span>
                        <span className="font-semibold text-ink-primary">{m.title}</span>
                        <Badge variant={m.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                          {m.status}
                        </Badge>
                      </div>
                      <p className="text-ink-secondary mt-1 font-mono text-[11px]">
                        Planned: {formatDateIST(m.planned_start_date)} to {formatDateIST(m.planned_end_date)}
                        {m.actual_completion_date && ` • Completed: ${formatDateIST(m.actual_completion_date)}`}
                        {m.assignee && ` • Assignee: ${m.assignee.full_name}`}
                      </p>
                    </div>

                    <div>
                      {mDelay.isLateOrOverdue ? (
                        <span className="text-copper-dark font-mono text-[11px] font-semibold bg-copper-pale/60 px-2 py-0.5 rounded border border-copper/30">
                          ⚠️ {mDelay.displayText}
                        </span>
                      ) : (
                        <span className="text-ink-secondary font-mono text-[11px]">
                          {mDelay.displayText}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-forest">
              Project Team Membership
            </h3>
            {canManageMembers && !isArchived && (
              <Button size="sm" onClick={() => setShowAddMember(true)} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Member
              </Button>
            )}
          </div>

          {/* Add Member Form Modal Card */}
          {showAddMember && (
            <Card className="border-sage bg-sage-pale/40 p-4">
              <form onSubmit={handleAddMember} className="space-y-3">
                <h4 className="text-xs font-semibold text-forest">
                  Add Active Employee to Project Scope
                </h4>
                <select
                  value={selectedNewMember}
                  onChange={(e) => setSelectedNewMember(e.target.value)}
                  className="w-full h-8 rounded border border-divider text-xs bg-ivory-surface px-2 font-mono text-ink-primary focus:border-forest"
                  required
                >
                  <option value="">Select active employee...</option>
                  {eligibleEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_id} • {e.department} • {e.designation})
                    </option>
                  ))}
                </select>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddMember(false)} className="text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={actionLoading || !selectedNewMember} className="text-xs">
                    Add Team Member
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="divide-y divide-divider/60 rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
            {/* Project Owner Row */}
            <div className="p-3.5 flex items-center justify-between text-xs bg-sage-pale/30">
              <div className="flex items-center space-x-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-ivory-surface font-bold text-[10px]">
                  OW
                </div>
                <div>
                  <span className="font-semibold text-forest">
                    {project.owner?.full_name || 'Owner Unassigned'}
                  </span>
                  <span className="text-[11px] text-ink-secondary block font-mono">
                    {project.owner?.employee_id} • {project.owner?.designation} • {project.owner?.department}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-forest border-sage/60 font-mono text-[10px] bg-ivory-surface">
                Authoritative Owner
              </Badge>
            </div>

            {/* Members List */}
            {members.map((member) => (
              <div key={member.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-sage-pale/20 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ivory text-forest border border-divider font-bold text-[10px]">
                    {member.employee?.full_name ? member.employee.full_name.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div>
                    <span className="font-semibold text-ink-primary">
                      {member.employee?.full_name}
                    </span>
                    <span className="text-[11px] text-ink-secondary block font-mono">
                      {member.employee?.employee_id} • {member.employee?.designation} • Added {formatDateIST(member.added_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge variant={member.status === 'active' ? 'success' : 'outline'} className="text-[10px] uppercase">
                    {member.status}
                  </Badge>

                  {canManageMembers && member.status === 'active' && !isArchived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.employee_id, member.employee?.full_name || 'Member')}
                      disabled={actionLoading}
                      className="text-xs text-status-danger hover:text-red-700 h-7 px-2"
                      title="Remove Member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVITY & AUDIT HISTORY */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-forest">
            Immutable Audit Trail for {project.project_code}
          </h3>

          {auditEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-divider bg-ivory-surface p-8 text-center text-xs text-ink-secondary">
              No audit events logged specifically for this project ID.
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditEvents.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-divider/70 bg-ivory-surface p-3 text-xs shadow-warm-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-forest">
                      {log.action}
                    </span>
                    <span className="font-mono text-[11px] text-ink-secondary">
                      {formatDateIST(log.created_at)}
                    </span>
                  </div>
                  {log.new_values && (
                    <pre className="mt-1 text-[11px] bg-ivory p-2 rounded text-ink-primary font-mono overflow-x-auto border border-divider/60">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
