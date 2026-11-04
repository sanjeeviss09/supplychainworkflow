import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchProjectById, updateProject } from '@/services/projectService';
import { Project, ProjectStatus } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Edit, ArrowLeft, Loader2, AlertCircle, Lock } from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function ProjectEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('draft');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [actualCompletionDate, setActualCompletionDate] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetchProjectById(projectId)
      .then((res) => {
        if (res.data) {
          setProject(res.data);
          setName(res.data.name || res.data.title || '');
          setDescription(res.data.description || '');
          setStatus(res.data.status);
          setPlannedStartDate(res.data.planned_start_date ? res.data.planned_start_date.split('T')[0] : '');
          setPlannedEndDate(res.data.planned_end_date ? res.data.planned_end_date.split('T')[0] : '');
          setActualCompletionDate(res.data.actual_completion_date ? res.data.actual_completion_date.split('T')[0] : '');
        } else if (res.error) {
          setServerError(res.error);
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Project name is required and cannot be empty.';
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

    if (status === 'completed' && !actualCompletionDate) {
      errors.actualCompletionDate = 'A project marked as Completed must have an actual completion date.';
    }

    if (actualCompletionDate && plannedStartDate && actualCompletionDate < plannedStartDate) {
      errors.actualCompletionDate = 'Actual completion date cannot precede planned start date.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const res = await updateProject(projectId, {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      planned_start_date: plannedStartDate,
      planned_end_date: plannedEndDate,
      actual_completion_date: status === 'completed' ? actualCompletionDate : null,
    });
    setIsSubmitting(false);

    if (res.error) {
      setServerError(res.error);
    } else {
      navigate(`/app/projects/${projectId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl border border-red-300 bg-rose-50 p-4 text-xs text-status-danger shadow-warm-sm">
          {serverError || 'Project not found.'}
        </div>
      </div>
    );
  }

  const isArchived = project.status === 'archived';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-ink-secondary">
        <Link to="/app/projects" className="hover:text-forest flex items-center font-medium">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Projects
        </Link>
        <span className="text-divider">/</span>
        <Link to={`/app/projects/${project.id}`} className="hover:text-forest font-mono">
          {project.project_code}
        </Link>
        <span className="text-divider">/</span>
        <span className="text-ink-primary font-semibold">Edit</span>
      </div>

      <Card className="border border-divider bg-ivory-surface shadow-warm-md">
        <CardHeader className="border-b border-divider/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-sage font-bold shadow-xs">
                <Edit className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-forest">
                  Edit Project {project.project_code}
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Update operational parameters, lifecycle status, and scheduled timelines.
                </CardDescription>
              </div>
            </div>
            <div className="font-mono text-xs text-ink-secondary">
              Version: <span className="font-semibold text-forest">v{project.version}</span>
            </div>
          </div>
        </CardHeader>

        {isArchived ? (
          <CardContent className="pt-6">
            <div className="rounded-xl border border-copper/40 bg-copper-pale/60 p-4 text-xs text-copper-dark flex items-start space-x-2.5">
              <Lock className="h-5 w-5 text-copper shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sm block">Archived Project is Read-Only</span>
                <p className="mt-1 leading-relaxed">
                  This project was archived on {formatDateIST(project.archived_at)}. Archived projects cannot be edited or modified. Historical records, milestones, and memberships remain permanently preserved.
                </p>
              </div>
            </div>
          </CardContent>
        ) : (
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
                <Label htmlFor="projectName">Project Name <span className="text-status-danger">*</span></Label>
                <Input
                  id="projectName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs"
                  required
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-status-danger font-medium">{fieldErrors.name}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Project Description</Label>
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-divider bg-ivory-surface p-2.5 text-xs text-ink-primary placeholder:text-ink-muted/70 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-colors"
                />
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="status">Project Lifecycle Status</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  disabled={isSubmitting}
                  className="w-full h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                >
                  <option value="draft">Draft (Initial formulation)</option>
                  <option value="planned">Planned (Milestones structured)</option>
                  <option value="active">Active (In execution)</option>
                  <option value="on_hold">On Hold (Temporarily paused)</option>
                  <option value="completed">Completed (Execution finished)</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plannedStartDate">Planned Start Date <span className="text-status-danger">*</span></Label>
                  <Input
                    id="plannedStartDate"
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs font-mono"
                    required
                  />
                  {fieldErrors.plannedStartDate && (
                    <p className="text-[11px] text-status-danger font-medium">{fieldErrors.plannedStartDate}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plannedEndDate">Planned End Date <span className="text-status-danger">*</span></Label>
                  <Input
                    id="plannedEndDate"
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs font-mono"
                    required
                  />
                  {fieldErrors.plannedEndDate && (
                    <p className="text-[11px] text-status-danger font-medium">{fieldErrors.plannedEndDate}</p>
                  )}
                </div>
              </div>

              {/* Actual Completion Date (Conditional on status === completed) */}
              {status === 'completed' && (
                <div className="space-y-1.5 p-3.5 rounded-lg border border-sage/60 bg-sage-pale/40">
                  <Label htmlFor="actualCompletionDate" className="text-forest font-semibold">
                    Actual Completion Date <span className="text-status-danger">*</span>
                  </Label>
                  <Input
                    id="actualCompletionDate"
                    type="date"
                    value={actualCompletionDate}
                    onChange={(e) => setActualCompletionDate(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs font-mono bg-ivory-surface"
                    required
                  />
                  {fieldErrors.actualCompletionDate && (
                    <p className="text-[11px] text-status-danger font-medium">{fieldErrors.actualCompletionDate}</p>
                  )}
                  <p className="text-[11px] text-ink-secondary">
                    Actual date when all project objectives and deliverables were formally signed off.
                  </p>
                </div>
              )}
            </CardContent>

            <CardFooter className="border-t border-divider/60 pt-4 flex items-center justify-between">
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to={`/app/projects/${projectId}`}>Cancel</Link>
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-xs font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
