import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchEmployeesList, fetchEmployeeImportBatches } from '@/services/employeeService';
import { fetchAuditLogs } from '@/services/auditService';
import { fetchProjectsList } from '@/services/projectService';
import { Employee, EmployeeImportBatch, AuditLog, Project } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  ShieldCheck,
  FolderKanban,
  FileSpreadsheet,
  Coins,
  ShoppingCart,
  Truck,
  ArrowRight,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  Shield,
  Loader2,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Sparkles,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';
import { calculateProjectDelay } from '@/lib/projectCalculations';

export function DashboardPage() {
  const { employee, user, role, permissions, mustChangePassword } = useAuth();

  // Super Admin telemetry
  const [employeeStats, setEmployeeStats] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [recentBatches, setRecentBatches] = useState<EmployeeImportBatch[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [loadingSuperAdmin, setLoadingSuperAdmin] = useState(false);

  // Real Projects & Milestones Telemetry
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Load real projects for SCM metrics
    setLoadingProjects(true);
    fetchProjectsList()
      .then((res: { data?: Project[] }) => {
        if (isMounted && res.data) {
          setProjects(res.data);
        }
      })
      .catch((err: any) => {
        console.error('Failed to fetch projects for dashboard:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingProjects(false);
      });

    // Load Super Admin specific data if authorized
    if (role === 'super_admin') {
      setLoadingSuperAdmin(true);
      Promise.all([
        fetchEmployeesList(),
        fetchEmployeeImportBatches(4),
        fetchAuditLogs({ limit: 4 }),
      ])
        .then(([empRes, batchRes, auditRes]) => {
          if (!isMounted) return;
          if (empRes.data) {
            const total = empRes.data.length;
            const active = empRes.data.filter((e) => e.is_active).length;
            setEmployeeStats({ total, active, inactive: total - active });
          }
          if (batchRes.data) {
            setRecentBatches(batchRes.data);
          }
          if (auditRes.data) {
            setRecentAuditLogs(auditRes.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load Super Admin dashboard telemetry:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingSuperAdmin(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [role]);

  // Derived real project KPIs
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const plannedProjects = projects.filter((p) => p.status === 'planned' || p.status === 'draft').length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const onHoldProjects = projects.filter((p) => p.status === 'on_hold').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" className="text-[10px] font-mono">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="text-[10px] font-mono">Completed</Badge>;
      case 'on_hold':
        return <Badge variant="warning" className="text-[10px] font-mono">On Hold</Badge>;
      case 'planned':
        return <Badge variant="outline" className="text-[10px] font-mono">Planned</Badge>;
      case 'draft':
        return <Badge variant="outline" className="text-[10px] font-mono">Draft</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner — Forest Green & Warm Ivory */}
      <div className="rounded-xl border border-divider bg-ivory-surface p-5 sm:p-6 shadow-warm-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-forest uppercase tracking-wider">
                Enterprise SCM Platform
              </span>
              <span className="text-divider">•</span>
              <span className="text-xs text-ink-secondary">Internal Deployment</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest mt-1">
              Welcome, {employee?.full_name || user?.email?.split('@')[0]}
            </h1>
            <p className="text-xs text-ink-secondary mt-1 max-w-2xl leading-relaxed">
              Employee ID: <strong className="text-ink-primary font-mono">{employee?.employee_id || 'System User'}</strong> • Department: <span className="text-ink-primary font-medium">{employee?.department || 'Operations'}</span> • Designation: <span className="text-ink-primary font-medium">{employee?.designation || 'Staff'}</span> • Role:{' '}
              <span className="font-semibold text-forest capitalize">{role?.replace(/_/g, ' ')}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="rounded-lg border border-divider bg-ivory px-3 py-2 text-right">
              <span className="text-[10px] text-ink-secondary uppercase tracking-wider block font-semibold">Active Base</span>
              <span className="text-xs font-mono font-bold text-forest">
                INR (₹) • Asia/Kolkata
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          OPERATIONAL KPI METRIC CARDS (REAL DATA ONLY)
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Projects */}
        <Card className="hover:border-sage transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-ink-secondary">Authorized Projects</CardTitle>
              <div className="p-2 rounded-lg bg-sage-pale text-forest">
                <FolderKanban className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <Loader2 className="h-6 w-6 animate-spin text-forest" />
            ) : (
              <div className="text-2xl font-bold font-mono text-forest">
                {totalProjects}
              </div>
            )}
            <p className="text-[11px] text-ink-secondary mt-1">Total in authorized scope</p>
          </CardContent>
        </Card>

        {/* KPI 2: Active Projects */}
        <Card className="hover:border-sage transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-ink-secondary">Active In-Execution</CardTitle>
              <div className="p-2 rounded-lg bg-emerald-50 text-status-success">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <Loader2 className="h-6 w-6 animate-spin text-forest" />
            ) : (
              <div className="text-2xl font-bold font-mono text-status-success">
                {activeProjects}
              </div>
            )}
            <p className="text-[11px] text-ink-secondary mt-1">WBS milestones running</p>
          </CardContent>
        </Card>

        {/* KPI 3: Planned / In-Draft */}
        <Card className="hover:border-sage transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-ink-secondary">Planned & Staged</CardTitle>
              <div className="p-2 rounded-lg bg-copper-pale text-copper-dark">
                <Clock className="h-4 w-4 text-copper" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <Loader2 className="h-6 w-6 animate-spin text-forest" />
            ) : (
              <div className="text-2xl font-bold font-mono text-copper-dark">
                {plannedProjects}
              </div>
            )}
            <p className="text-[11px] text-ink-secondary mt-1">Pending budget/scheduling</p>
          </CardContent>
        </Card>

        {/* KPI 4: Security & Governance Status */}
        <Card className="hover:border-sage transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-ink-secondary">Access Control & RLS</CardTitle>
              <div className="p-2 rounded-lg bg-sage-pale text-forest">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold font-mono text-forest flex items-center space-x-1.5 pt-1">
              <span className="h-2 w-2 rounded-full bg-status-success" />
              <span>Enforced</span>
            </div>
            <p className="text-[11px] text-ink-secondary mt-2">Row Level Security Active</p>
          </CardContent>
        </Card>
      </div>

      {/* =====================================================================
          PROJECT WORKSPACE INSIGHTS & ACTIONS GRID
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Project Progress Visualization & Recent Projects */}
        <div className="lg:col-span-2 space-y-6">
          {/* Projects Overview Panel */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-divider/60">
              <div>
                <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-sage-dark" />
                  <span>Authorized Projects Overview</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Real project records accessible within your role and department scope.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to="/app/projects">
                  <span>View All Projects</span>
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingProjects ? (
                <div className="py-8 text-center text-xs text-ink-secondary">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-forest" />
                  Loading authorized project records...
                </div>
              ) : projects.length === 0 ? (
                <div className="py-8 text-center">
                  <FolderKanban className="h-8 w-8 mx-auto text-sage/60 mb-2" />
                  <p className="text-xs text-ink-secondary">No projects enrolled in your authorized department scope.</p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/app/projects/new">Create First Project</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 4).map((proj) => {
                    const delayInfo = calculateProjectDelay(proj.planned_end_date, proj.actual_completion_date, proj.status);
                    return (
                      <div
                        key={proj.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-divider/70 bg-ivory/50 hover:bg-sage-pale/25 transition-colors gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/app/projects/${proj.id}`}
                              className="font-semibold text-xs sm:text-sm text-forest hover:underline truncate"
                            >
                              {proj.name}
                            </Link>
                            <span className="text-[11px] font-mono text-ink-secondary">
                              ({proj.project_code})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-ink-secondary mt-1">
                            <span>{proj.department?.name || 'Department Project'}</span>
                            <span>•</span>
                            <span className="font-mono">{formatDateIST(proj.planned_start_date)} to {formatDateIST(proj.planned_end_date)}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {delayInfo.isLateOrOverdue && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-copper-pale text-copper-dark border border-copper/30">
                              {delayInfo.displayText}
                            </span>
                          )}
                          {getStatusBadge(proj.status)}
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                            <Link to={`/app/projects/${proj.id}`}>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real Project Breakdown Distribution Chart / Bar */}
          {projects.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                  Lifecycle Status Distribution
                </h3>
                <span className="text-xs font-mono text-ink-secondary">
                  {projects.length} Total Records
                </span>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-ivory flex overflow-hidden border border-divider">
                  {activeProjects > 0 && (
                    <div
                      style={{ width: `${(activeProjects / totalProjects) * 100}%` }}
                      className="bg-forest transition-all"
                      title={`Active: ${activeProjects}`}
                    />
                  )}
                  {plannedProjects > 0 && (
                    <div
                      style={{ width: `${(plannedProjects / totalProjects) * 100}%` }}
                      className="bg-sage transition-all"
                      title={`Planned: ${plannedProjects}`}
                    />
                  )}
                  {completedProjects > 0 && (
                    <div
                      style={{ width: `${(completedProjects / totalProjects) * 100}%` }}
                      className="bg-status-success transition-all"
                      title={`Completed: ${completedProjects}`}
                    />
                  )}
                  {onHoldProjects > 0 && (
                    <div
                      style={{ width: `${(onHoldProjects / totalProjects) * 100}%` }}
                      className="bg-copper transition-all"
                      title={`On Hold: ${onHoldProjects}`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-secondary pt-1">
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-full bg-forest" />
                    <span>Active ({activeProjects})</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-full bg-sage" />
                    <span>Planned ({plannedProjects})</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-full bg-status-success" />
                    <span>Completed ({completedProjects})</span>
                  </span>
                  {onHoldProjects > 0 && (
                    <span className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-copper" />
                      <span>On Hold ({onHoldProjects})</span>
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (1 span): Project Insights & My Actions */}
        <div className="space-y-6">
          {/* Project Insights Panel — Forest Green & Sage Atmosphere */}
          <div className="rounded-xl border border-forest-deep bg-forest text-ivory-surface p-5 shadow-warm-md">
            <div className="flex items-center space-x-2 text-sage mb-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Project Insights</span>
            </div>
            <h4 className="text-sm font-semibold text-white">Operational Readiness</h4>
            <p className="text-xs text-ivory/85 mt-1 leading-relaxed">
              All project authorizations conform to Phase 4 multi-step access rules. Materials (BOM), Budgets, and Requisitions link cleanly once created.
            </p>
            <div className="mt-4 pt-4 border-t border-forest-light/60 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase text-sage/80 block">Active Projects</span>
                <span className="font-mono font-bold text-white text-base">{activeProjects}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-sage/80 block">Completed</span>
                <span className="font-mono font-bold text-white text-base">{completedProjects}</span>
              </div>
            </div>
          </div>

          {/* My Actions Panel */}
          <Card>
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-forest" />
                <span>My Actions</span>
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Pending operational tasks requiring your attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {mustChangePassword && (
                <div className="p-3 rounded-lg border border-copper/40 bg-copper-pale/60 text-xs">
                  <div className="font-semibold text-copper-dark flex items-center space-x-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-copper" />
                    <span>Rotate Temporary Password</span>
                  </div>
                  <p className="text-ink-secondary text-[11px] mt-0.5">
                    Your account is using default credentials. Update your password to maintain compliance.
                  </p>
                  <Button asChild size="sm" variant="copper" className="mt-2 text-xs h-7">
                    <Link to="/reset-password">Rotate Password Now</Link>
                  </Button>
                </div>
              )}

              {plannedProjects > 0 && (
                <div className="p-3 rounded-lg border border-divider bg-ivory/50 text-xs">
                  <div className="font-semibold text-forest flex items-center space-x-1.5">
                    <Clock className="h-3.5 w-3.5 text-sage-dark" />
                    <span>Review Planned Milestones</span>
                  </div>
                  <p className="text-ink-secondary text-[11px] mt-0.5">
                    {plannedProjects} project(s) are in planned/draft status awaiting milestone sign-offs.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-2 text-xs h-7">
                    <Link to="/app/projects">Open Projects</Link>
                  </Button>
                </div>
              )}

              {!mustChangePassword && plannedProjects === 0 && (
                <div className="py-4 text-center text-xs text-ink-secondary">
                  <CheckCircle2 className="h-5 w-5 text-status-success mx-auto mb-1" />
                  <span>No outstanding action items in your queue.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* =====================================================================
          SUPER ADMIN REAL ADMINISTRATIVE LOGS (IF SUPER ADMIN)
         ===================================================================== */}
      {role === 'super_admin' && (
        <div className="space-y-6 pt-4 border-t border-divider">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-forest" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-forest">
              Platform Administration Telemetry
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Employee Import Batches */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-divider/60">
                <div>
                  <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                    <History className="h-4 w-4 text-sage-dark" />
                    <span>Recent Employee Import Batches</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-secondary">
                    Audit log of verified CSV and Excel roster imports.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/app/admin/imports">
                    <span>View All</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {loadingSuperAdmin ? (
                  <div className="py-8 text-center text-xs text-ink-secondary">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-forest" />
                    Loading import history...
                  </div>
                ) : recentBatches.length === 0 ? (
                  <div className="py-6 text-center text-xs text-ink-secondary">
                    No bulk employee imports committed yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentBatches.map((batch) => (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between rounded-lg border border-divider/70 bg-ivory/50 p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-mono font-medium text-ink-primary">
                            {batch.file_name}
                          </span>
                          <span className="text-[11px] text-ink-secondary block">
                            {formatDateIST(batch.created_at)} • {batch.total_rows} total rows
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[11px] text-status-success font-semibold">
                            +{batch.accepted_rows}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {batch.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Administrative Audit Events */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-divider/60">
                <div>
                  <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-sage-dark" />
                    <span>Recent Administrative Audit Events</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-secondary">
                    Immutable security events recorded on PostgreSQL.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/app/admin/audit-log">
                    <span>Full Log</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {loadingSuperAdmin ? (
                  <div className="py-8 text-center text-xs text-ink-secondary">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-forest" />
                    Loading security audit trail...
                  </div>
                ) : recentAuditLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-ink-secondary">
                    No security audit events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border border-divider/70 bg-ivory/50 p-2.5 text-xs"
                      >
                        <div className="max-w-[70%]">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-[11px] font-semibold text-ink-primary">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-ink-secondary">({log.table_name})</span>
                          </div>
                          <span className="text-[11px] text-ink-secondary block truncate">
                            {formatDateIST(log.created_at)} • Target: {log.target_employee_id || 'System'}
                          </span>
                        </div>
                        <Badge
                          variant={log.outcome === 'FAILURE' ? 'destructive' : 'outline'}
                          className="text-[10px] font-mono"
                        >
                          {log.outcome || 'SUCCESS'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
