import { describe, it, expect } from 'vitest';
import {
  calculateProjectDelay,
  calculateMilestoneDelay,
  calculateProjectProgress,
  normalizeDateOnly,
} from '../projectCalculations';
import { Milestone } from '@/types/database.types';

describe('Phase 4 Project & Milestone Calculations', () => {
  const referenceDate = '2026-11-03';

  describe('Project Delay Calculations', () => {
    it('calculates on-time status when incomplete project end date is in the future', () => {
      // Planned end: Nov 15, Reference: Nov 03 -> 12 days remaining
      const result = calculateProjectDelay('2026-11-15', null, 'active', referenceDate);
      expect(result.isLateOrOverdue).toBe(false);
      expect(result.statusLabel).toBe('on_time');
      expect(result.calendarDaysLate).toBe(0);
      expect(result.displayText).toContain('12 days remaining');
    });

    it('identifies an incomplete project as overdue when planned end date has passed', () => {
      // Planned end: Oct 25, Reference: Nov 03 -> 9 days overdue
      const result = calculateProjectDelay('2026-10-25', null, 'active', referenceDate);
      expect(result.isLateOrOverdue).toBe(true);
      expect(result.statusLabel).toBe('overdue');
      expect(result.calendarDaysLate).toBe(9);
      expect(result.displayText).toContain('Overdue by 9 days');
    });

    it('identifies project due today without labeling it overdue', () => {
      const result = calculateProjectDelay('2026-11-03', null, 'active', referenceDate);
      expect(result.isLateOrOverdue).toBe(false);
      expect(result.calendarDaysLate).toBe(0);
      expect(result.displayText).toBe('Due today');
    });

    it('does NOT label a completed project late when completed on or before planned end date', () => {
      // Planned: Nov 10, Completed: Nov 05 -> Early
      const early = calculateProjectDelay('2026-11-10', '2026-11-05', 'completed', referenceDate);
      expect(early.isLateOrOverdue).toBe(false);
      expect(early.statusLabel).toBe('early');
      expect(early.calendarDaysLate).toBe(0);
      expect(early.displayText).toContain('5 days early');

      // Planned: Nov 10, Completed: Nov 10 -> On Schedule
      const onSchedule = calculateProjectDelay('2026-11-10', '2026-11-10', 'completed', referenceDate);
      expect(onSchedule.isLateOrOverdue).toBe(false);
      expect(onSchedule.statusLabel).toBe('completed_on_time');
      expect(onSchedule.calendarDaysLate).toBe(0);
      expect(onSchedule.displayText).toBe('Completed on schedule');
    });

    it('labels a completed project late only if actual completion date is after planned end date', () => {
      // Planned: Oct 20, Completed: Oct 28 -> 8 days late
      const late = calculateProjectDelay('2026-10-20', '2026-10-28', 'completed', referenceDate);
      expect(late.isLateOrOverdue).toBe(true);
      expect(late.statusLabel).toBe('completed_late');
      expect(late.calendarDaysLate).toBe(8);
      expect(late.displayText).toBe('Completed 8 days late');
    });

    it('handles archived projects as neutral status', () => {
      const archived = calculateProjectDelay('2026-10-01', null, 'archived', referenceDate);
      expect(archived.isLateOrOverdue).toBe(false);
      expect(archived.statusLabel).toBe('archived');
      expect(archived.displayText).toBe('Archived');
    });
  });

  describe('Milestone Delay Calculations', () => {
    it('evaluates milestone delay independently of project overall status', () => {
      // Milestone overdue independently
      const overdueMilestone = calculateMilestoneDelay('2026-10-28', null, 'active', referenceDate);
      expect(overdueMilestone.isLateOrOverdue).toBe(true);
      expect(overdueMilestone.calendarDaysLate).toBe(6);

      // Milestone completed on time
      const onTimeMilestone = calculateMilestoneDelay('2026-10-20', '2026-10-18', 'completed', referenceDate);
      expect(onTimeMilestone.isLateOrOverdue).toBe(false);
      expect(onTimeMilestone.statusLabel).toBe('early');
    });
  });

  describe('Project Progress Calculations', () => {
    it('returns "No milestones" when a project has zero non-archived milestones', () => {
      const emptyResult = calculateProjectProgress([]);
      expect(emptyResult.hasMilestones).toBe(false);
      expect(emptyResult.progressPercentage).toBeNull();
      expect(emptyResult.displayLabel).toBe('No milestones');

      const onlyArchived = calculateProjectProgress([
        { status: 'archived', actual_completion_date: null },
      ]);
      expect(onlyArchived.hasMilestones).toBe(false);
      expect(onlyArchived.progressPercentage).toBeNull();
      expect(onlyArchived.displayLabel).toBe('No milestones');
    });

    it('calculates exact percentage: completed non-archived / total non-archived × 100', () => {
      const milestones: Array<Pick<Milestone, 'status' | 'actual_completion_date'>> = [
        { status: 'completed', actual_completion_date: '2026-10-15' },
        { status: 'completed', actual_completion_date: '2026-10-22' },
        { status: 'active', actual_completion_date: null },
        { status: 'draft', actual_completion_date: null },
        { status: 'archived', actual_completion_date: null }, // excluded from denominator
      ];

      // 2 completed out of 4 non-archived = 50%
      const progress = calculateProjectProgress(milestones);
      expect(progress.hasMilestones).toBe(true);
      expect(progress.totalActiveMilestones).toBe(4);
      expect(progress.completedMilestones).toBe(2);
      expect(progress.progressPercentage).toBe(50);
      expect(progress.displayLabel).toBe('50% (2/4)');
    });

    it('does not count a milestone as complete if actual_completion_date is missing', () => {
      const milestones: Array<Pick<Milestone, 'status' | 'actual_completion_date'>> = [
        { status: 'completed', actual_completion_date: null }, // invalid completion data!
        { status: 'active', actual_completion_date: null },
      ];

      const progress = calculateProjectProgress(milestones);
      expect(progress.completedMilestones).toBe(0);
      expect(progress.progressPercentage).toBe(0);
    });
  });

  describe('Date Normalization', () => {
    it('normalizes date strings consistently without UTC off-by-one boundary shifts', () => {
      const date = normalizeDateOnly('2026-11-03');
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2026);
      expect(date?.getUTCMonth()).toBe(10); // 0-based Nov is 10
      expect(date?.getUTCDate()).toBe(3);
    });
  });
});

