import { Milestone } from '@/types/database.types';

/**
 * Normalizes a date-only string ('YYYY-MM-DD') or Date object into a pure UTC date-only timestamp (midnight).
 * This eliminates off-by-one errors caused by local browser vs UTC conversion.
 */
export function normalizeDateOnly(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    // If string in 'YYYY-MM-DD' format
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(Date.UTC(year, month, day));
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface DelayCalculationResult {
  isLateOrOverdue: boolean;
  statusLabel: 'on_time' | 'early' | 'overdue' | 'completed_late' | 'completed_on_time' | 'archived';
  calendarDaysLate: number;
  displayText: string;
}

/**
 * Calculates project delay in calendar days.
 * - Completed project: compare actualCompletionDate with plannedEndDate.
 * - Incomplete project: compare referenceDate (defaults to today) with plannedEndDate.
 * - Incomplete project is overdue ONLY if plannedEndDate < today.
 * - Completed project is late ONLY if actualCompletionDate > plannedEndDate.
 * - Does NOT label a project late when completed on or before planned end date.
 */
export function calculateProjectDelay(
  plannedEndDateStr: string,
  actualCompletionDateStr?: string | null,
  status: string = 'draft',
  referenceDateInput?: string | Date
): DelayCalculationResult {
  if (status.toLowerCase() === 'archived') {
    return {
      isLateOrOverdue: false,
      statusLabel: 'archived',
      calendarDaysLate: 0,
      displayText: 'Archived',
    };
  }

  const plannedEnd = normalizeDateOnly(plannedEndDateStr);
  if (!plannedEnd) {
    return {
      isLateOrOverdue: false,
      statusLabel: 'on_time',
      calendarDaysLate: 0,
      displayText: 'Planned',
    };
  }

  const isCompleted = status.toLowerCase() === 'completed';
  const actualCompletion = normalizeDateOnly(actualCompletionDateStr);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  if (isCompleted) {
    if (!actualCompletion) {
      return {
        isLateOrOverdue: false,
        statusLabel: 'completed_on_time',
        calendarDaysLate: 0,
        displayText: 'Completed',
      };
    }

    const diffDays = Math.round((actualCompletion.getTime() - plannedEnd.getTime()) / MS_PER_DAY);

    if (diffDays > 0) {
      return {
        isLateOrOverdue: true,
        statusLabel: 'completed_late',
        calendarDaysLate: diffDays,
        displayText: `Completed ${diffDays} ${diffDays === 1 ? 'day' : 'days'} late`,
      };
    } else if (diffDays < 0) {
      const earlyDays = Math.abs(diffDays);
      return {
        isLateOrOverdue: false,
        statusLabel: 'early',
        calendarDaysLate: 0,
        displayText: `Completed ${earlyDays} ${earlyDays === 1 ? 'day' : 'days'} early`,
      };
    } else {
      return {
        isLateOrOverdue: false,
        statusLabel: 'completed_on_time',
        calendarDaysLate: 0,
        displayText: 'Completed on schedule',
      };
    }
  }

  // Project is not completed
  const refDate = normalizeDateOnly(referenceDateInput) || normalizeDateOnly(new Date())!;
  const diffFromToday = Math.round((refDate.getTime() - plannedEnd.getTime()) / MS_PER_DAY);

  if (diffFromToday > 0) {
    return {
      isLateOrOverdue: true,
      statusLabel: 'overdue',
      calendarDaysLate: diffFromToday,
      displayText: `Overdue by ${diffFromToday} ${diffFromToday === 1 ? 'day' : 'days'}`,
    };
  }

  const daysRemaining = Math.abs(diffFromToday);
  return {
    isLateOrOverdue: false,
    statusLabel: 'on_time',
    calendarDaysLate: 0,
    displayText: daysRemaining === 0 ? 'Due today' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`,
  };
}

/**
 * Calculates milestone delay independently from project delay.
 */
export function calculateMilestoneDelay(
  plannedEndDateStr: string,
  actualCompletionDateStr?: string | null,
  status: string = 'draft',
  referenceDateInput?: string | Date
): DelayCalculationResult {
  return calculateProjectDelay(plannedEndDateStr, actualCompletionDateStr, status, referenceDateInput);
}

export interface ProjectProgressResult {
  hasMilestones: boolean;
  totalActiveMilestones: number;
  completedMilestones: number;
  progressPercentage: number | null;
  displayLabel: string;
}

/**
 * Calculates project milestone progress:
 * completed, non-archived milestones / total non-archived milestones × 100.
 * If there are no non-archived milestones, shows "No milestones" rather than 0% or 100%.
 */
export function calculateProjectProgress(
  milestones: Array<Pick<Milestone, 'status' | 'actual_completion_date'>> = []
): ProjectProgressResult {
  // Filter out archived milestones
  const activeMilestones = milestones.filter(
    (m) => m.status && m.status.toLowerCase() !== 'archived'
  );

  if (activeMilestones.length === 0) {
    return {
      hasMilestones: false,
      totalActiveMilestones: 0,
      completedMilestones: 0,
      progressPercentage: null,
      displayLabel: 'No milestones',
    };
  }

  const completedCount = activeMilestones.filter(
    (m) => m.status.toLowerCase() === 'completed' && Boolean(m.actual_completion_date)
  ).length;

  const percentage = Math.round((completedCount / activeMilestones.length) * 100);

  return {
    hasMilestones: true,
    totalActiveMilestones: activeMilestones.length,
    completedMilestones: completedCount,
    progressPercentage: percentage,
    displayLabel: `${percentage}% (${completedCount}/${activeMilestones.length})`,
  };
}

