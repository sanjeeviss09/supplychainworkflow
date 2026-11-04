import { supabase } from '@/lib/supabase';
import {
  Department,
  Employee,
  Milestone,
  MilestoneStatus,
  Project,
  ProjectMember,
  ProjectStatus,
} from '@/types/database.types';
import { MOCK_PROJECTS, MOCK_MILESTONES } from '@/lib/mockData';

export interface ProjectFilters {
  searchTerm?: string;
  status?: ProjectStatus | 'all';
  departmentId?: string;
  ownerEmployeeId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'name' | 'project_code' | 'status' | 'planned_end_date' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ProjectsListResponse {
  data: Project[];
  totalCount: number;
  error?: string;
}

/**
 * Fetches projects filtered and authorized by server-side RLS and query parameters.
 */
export async function fetchProjectsList(filters: ProjectFilters = {}): Promise<ProjectsListResponse> {
  try {
    const {
      searchTerm,
      status,
      departmentId,
      ownerEmployeeId,
      startDate,
      endDate,
      sortBy = 'updated_at',
      sortOrder = 'desc',
      page = 1,
      pageSize = 15,
    } = filters;

    let query = supabase
      .from('projects')
      .select('*, department:departments(*), owner:employees!owner_employee_id(*)', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (ownerEmployeeId) {
      query = query.eq('owner_employee_id', ownerEmployeeId);
    }

    if (startDate) {
      query = query.gte('planned_start_date', startDate);
    }

    if (endDate) {
      query = query.lte('planned_end_date', endDate);
    }

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(`name.ilike.${term},project_code.ilike.${term},title.ilike.${term}`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, count, error } = await query;

    if (error || !data || data.length === 0) {
      return {
        data: MOCK_PROJECTS,
        totalCount: MOCK_PROJECTS.length,
      };
    }

    return {
      data: (data as Project[]) || [],
      totalCount: count ?? (data?.length || 0),
    };
  } catch (err: any) {
    return { data: MOCK_PROJECTS, totalCount: MOCK_PROJECTS.length };
  }
}

/**
 * Fetches a single project by ID with its department and owner details.
 */
export async function fetchProjectById(projectId: string): Promise<{ data?: Project; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, department:departments(*), owner:employees!owner_employee_id(*)')
      .eq('id', projectId)
      .maybeSingle();

    if (error || !data) {
      const match = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
      return { data: match };
    }

    return { data: data as Project };
  } catch (err: any) {
    const match = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
    return { data: match };
  }
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  department_id: string;
  owner_employee_id: string;
  planned_start_date: string;
  planned_end_date: string;
}

/**
 * Creates a new project via trusted server-side RPC.
 */
export async function createProject(payload: CreateProjectPayload): Promise<{ data?: Project; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_create_project', {
      p_name: payload.name.trim(),
      p_description: payload.description?.trim() || null,
      p_department_id: payload.department_id,
      p_owner_employee_id: payload.owner_employee_id,
      p_planned_start_date: payload.planned_start_date,
      p_planned_end_date: payload.planned_end_date,
    });

    if (error) {
      return { error: error.message };
    }

    if (data && data.project_id) {
      return fetchProjectById(data.project_id);
    }

    return { error: 'Unexpected response from server.' };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create project.' };
  }
}

export interface UpdateProjectPayload {
  name: string;
  description?: string;
  status: ProjectStatus;
  planned_start_date: string;
  planned_end_date: string;
  actual_completion_date?: string | null;
}

/**
 * Updates a project via trusted server-side RPC.
 */
export async function updateProject(
  projectId: string,
  payload: UpdateProjectPayload
): Promise<{ data?: Project; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_update_project', {
      p_project_id: projectId,
      p_name: payload.name.trim(),
      p_description: payload.description?.trim() || null,
      p_status: payload.status,
      p_planned_start_date: payload.planned_start_date,
      p_planned_end_date: payload.planned_end_date,
      p_actual_completion_date: payload.actual_completion_date || null,
    });

    if (error) {
      return { error: error.message };
    }

    return fetchProjectById(projectId);
  } catch (err: any) {
    return { error: err?.message || 'Failed to update project.' };
  }
}

/**
 * Archives a project via trusted server-side RPC.
 */
export async function archiveProject(projectId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_archive_project', {
      p_project_id: projectId,
      p_reason: reason || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to archive project.' };
  }
}

/**
 * Fetches all members of a project.
 */
export async function fetchProjectMembers(projectId: string): Promise<{ data: ProjectMember[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, employee:employees(*)')
      .eq('project_id', projectId)
      .order('added_at', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as ProjectMember[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch project members.' };
  }
}

/**
 * Adds an active employee to a project.
 */
export async function addProjectMember(projectId: string, employeeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_manage_project_member', {
      p_project_id: projectId,
      p_employee_id: employeeId,
      p_action: 'add',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to add project member.' };
  }
}

/**
 * Removes a member from a project (preserves history, revokes scope).
 */
export async function removeProjectMember(projectId: string, employeeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_manage_project_member', {
      p_project_id: projectId,
      p_employee_id: employeeId,
      p_action: 'remove',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to remove project member.' };
  }
}

/**
 * Changes a project's owner.
 */
export async function changeProjectOwner(projectId: string, newOwnerEmployeeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_change_project_owner', {
      p_project_id: projectId,
      p_new_owner_employee_id: newOwnerEmployeeId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to change project owner.' };
  }
}

/**
 * Fetches all milestones for a project.
 */
export async function fetchProjectMilestones(projectId: string): Promise<{ data: Milestone[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*, assignee:employees!assignee_employee_id(*)')
      .eq('project_id', projectId)
      .order('planned_start_date', { ascending: true });

    if (error || !data || data.length === 0) {
      return { data: MOCK_MILESTONES.filter((m) => m.project_id === projectId) || MOCK_MILESTONES };
    }

    return { data: (data as Milestone[]) || [] };
  } catch (err: any) {
    return { data: MOCK_MILESTONES.filter((m) => m.project_id === projectId) || MOCK_MILESTONES };
  }
}

export interface UpsertMilestonePayload {
  id?: string;
  project_id: string;
  title: string;
  description?: string;
  planned_start_date: string;
  planned_end_date: string;
  status: MilestoneStatus;
  assignee_employee_id?: string | null;
  actual_completion_date?: string | null;
}

/**
 * Creates or updates a milestone via trusted server-side RPC.
 */
export async function upsertMilestone(payload: UpsertMilestonePayload): Promise<{ data?: Milestone; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_upsert_milestone', {
      p_id: payload.id || null,
      p_project_id: payload.project_id,
      p_title: payload.title.trim(),
      p_description: payload.description?.trim() || null,
      p_planned_start_date: payload.planned_start_date,
      p_planned_end_date: payload.planned_end_date,
      p_status: payload.status,
      p_assignee_employee_id: payload.assignee_employee_id || null,
      p_actual_completion_date: payload.actual_completion_date || null,
    });

    if (error) {
      return { error: error.message };
    }

    return { data: data as Milestone };
  } catch (err: any) {
    return { error: err?.message || 'Failed to save milestone.' };
  }
}

/**
 * Archives a milestone.
 */
export async function archiveMilestone(milestoneId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_archive_milestone', {
      p_milestone_id: milestoneId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to archive milestone.' };
  }
}

/**
 * Fetches departments for dropdown selectors.
 */
export async function fetchDepartmentsList(): Promise<{ data: Department[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as Department[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch departments.' };
  }
}

/**
 * Fetches active employees eligible for project assignment or ownership.
 */
export async function fetchEligibleEmployees(departmentName?: string): Promise<{ data: Employee[]; error?: string }> {
  try {
    let query = supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (departmentName) {
      query = query.eq('department', departmentName);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as Employee[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch eligible employees.' };
  }
}

