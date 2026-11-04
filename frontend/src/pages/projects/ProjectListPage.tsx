import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchDepartmentsList, fetchProjectsList, ProjectFilters } from '@/services/projectService';
import { calculateProjectDelay } from '@/lib/projectCalculations';
import { Department, Project, ProjectStatus } from '@/types/database.types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderKanban,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Building,
  User,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function ProjectListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | 'all'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated_at' | 'name' | 'project_code' | 'planned_end_date'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const canCreate = hasPermission('projects.create');

  const loadProjects = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const filters: ProjectFilters = {
        searchTerm: searchTerm.trim() || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        departmentId: selectedDept !== 'all' ? selectedDept : undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      };

      const res = await fetchProjectsList(filters);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setProjects(res.data);
        setTotalCount(res.totalCount);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentsList().then((res) => {
      if (res.data) setDepartments(res.data);
    });
  }, []);

  useEffect(() => {
    loadProjects();
  }, [selectedStatus, selectedDept, sortBy, sortOrder, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProjects();
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'planned':
        return <Badge variant="sage">Planned</Badge>;
      case 'on_hold':
        return <Badge variant="warning">On Hold</Badge>;
      case 'archived':
        return <Badge variant="outline" className="text-ink-muted">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
            <FolderKanban className="h-6 w-6 text-forest" />
            <span>Projects & Milestones</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Work Breakdown Structures (WBS), milestone dependency schedules, and departmental scope tracking.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProjects}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canCreate && (
            <Button asChild size="sm">
              <Link to="/app/projects/new">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Project
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-divider bg-ivory-surface p-4 shadow-warm-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search box */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
            <Input
              type="text"
              placeholder="Search by project name or code (PRJ-...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              aria-label="Filter by Status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Department filter */}
          <div>
            <select
              aria-label="Filter by Department"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div>
            <select
              aria-label="Sort Order"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-') as [any, any];
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            >
              <option value="updated_at-desc">Updated (Newest first)</option>
              <option value="updated_at-asc">Updated (Oldest first)</option>
              <option value="name-asc">Name (A to Z)</option>
              <option value="name-desc">Name (Z to A)</option>
              <option value="planned_end_date-asc">Planned End (Earliest)</option>
              <option value="planned_end_date-desc">Planned End (Latest)</option>
            </select>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-rose-50 p-4 text-xs text-status-danger flex items-center justify-between shadow-warm-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
            <span>{errorMsg}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadProjects} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Projects Table */}
      <div className="rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Code</TableHead>
              <TableHead>Project Name & Scope</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Project Owner</TableHead>
              <TableHead>Planned Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule Telemetry</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-36 text-center text-xs text-ink-secondary">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-forest" />
                  Loading projects from database...
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center text-xs text-ink-secondary">
                  <FolderKanban className="h-8 w-8 text-sage/70 mx-auto mb-2" />
                  <p className="font-semibold text-ink-primary">
                    No projects found
                  </p>
                  <p className="text-[11px] text-ink-muted mt-1 max-w-sm mx-auto">
                    {searchTerm || selectedStatus !== 'all' || selectedDept !== 'all'
                      ? 'No project records match the current filter criteria.'
                      : 'No projects currently exist in your authorized department scope.'}
                  </p>
                  {canCreate && (
                    <Button asChild size="sm" variant="outline" className="mt-4 text-xs">
                      <Link to="/app/projects/new">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Create First Project
                      </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => {
                const delay = calculateProjectDelay(
                  project.planned_end_date,
                  project.actual_completion_date,
                  project.status
                );

                return (
                  <TableRow
                    key={project.id}
                    className="hover:bg-sage-pale/25 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/projects/${project.id}`)}
                  >
                    {/* Project Code */}
                    <TableCell className="font-mono text-xs font-bold text-forest">
                      {project.project_code}
                    </TableCell>

                    {/* Name */}
                    <TableCell>
                      <div className="font-semibold text-xs text-ink-primary">
                        {project.name || project.title}
                      </div>
                      {project.description && (
                        <p className="text-[11px] text-ink-secondary truncate max-w-xs mt-0.5">
                          {project.description}
                        </p>
                      )}
                    </TableCell>

                    {/* Department */}
                    <TableCell className="text-xs text-ink-secondary">
                      <div className="flex items-center space-x-1.5">
                        <Building className="h-3 w-3 text-ink-muted shrink-0" />
                        <span className="truncate max-w-[130px]">
                          {project.department?.name || 'Unassigned'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Owner */}
                    <TableCell className="text-xs text-ink-secondary">
                      <div className="flex items-center space-x-1.5">
                        <User className="h-3 w-3 text-ink-muted shrink-0" />
                        <span className="truncate max-w-[120px]">
                          {project.owner?.full_name || 'Owner Unassigned'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Planned Schedule */}
                    <TableCell className="text-xs font-mono whitespace-nowrap text-ink-secondary">
                      <div>{formatDateIST(project.planned_start_date)}</div>
                      <div className="text-[11px] text-ink-muted">to {formatDateIST(project.planned_end_date)}</div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {getStatusBadge(project.status)}
                    </TableCell>

                    {/* Delay Telemetry */}
                    <TableCell>
                      {delay.isLateOrOverdue ? (
                        <span className="inline-flex items-center text-[11px] font-mono font-medium text-copper-dark bg-copper-pale/70 px-2 py-0.5 rounded border border-copper/30">
                          <AlertTriangle className="h-3 w-3 mr-1 shrink-0 text-copper" />
                          {delay.displayText}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-mono text-ink-secondary">
                          <Clock className="h-3 w-3 mr-1 text-ink-muted" />
                          {delay.displayText}
                        </span>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button asChild variant="ghost" size="sm" className="text-xs text-forest hover:text-forest-deep">
                        <Link to={`/app/projects/${project.id}`}>
                          <span>View</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="border-t border-divider p-3 flex items-center justify-between text-xs text-ink-secondary bg-ivory/40">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} projects
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs"
              >
                Previous
              </Button>
              <span className="font-mono text-xs">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
