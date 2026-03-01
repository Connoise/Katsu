import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projects, tasks, timeBlocks, focusSessions, scheduleDays } from '../db/schema.js';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

const router = Router();

// GET /api/analytics/overview
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const allProjects = await db.select().from(projects);
    const activeProjects = allProjects.filter(p => p.status === 'active');
    const allTasks = await db.select().from(tasks);
    const allBlocks = await db.select().from(timeBlocks);
    const allSessions = await db.select().from(focusSessions);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completedThisWeek = allTasks.filter(t =>
      t.status === 'complete' && t.actualEnd && new Date(t.actualEnd) >= weekAgo
    ).length;

    const completedThisMonth = allTasks.filter(t =>
      t.status === 'complete' && t.actualEnd && new Date(t.actualEnd) >= monthAgo
    ).length;

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'complete').length;
    const startedOnTime = allTasks.filter(t => t.startedOnTime === true).length;
    const completedOnTime = allTasks.filter(t => t.completedOnTime === true).length;
    const tasksWithStartData = allTasks.filter(t => t.startedOnTime !== null).length;
    const tasksWithCompletionData = allTasks.filter(t => t.completedOnTime !== null).length;

    const totalBlocks = allBlocks.filter(b => b.blockType === 'task').length;
    const doneBlocks = allBlocks.filter(b => b.status === 'done').length;
    const skippedBlocks = allBlocks.filter(b => b.status === 'skipped').length;

    const totalFocusMinutes = allSessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.actualDuration || 0), 0);

    const totalEstimated = allTasks.reduce((sum, t) => sum + (t.durationEstimate || 0), 0);
    const totalActual = allTasks.reduce((sum, t) => sum + (t.durationActual || 0), 0);

    // Streak: consecutive days with at least one completed task
    const completedDates = allTasks
      .filter(t => t.status === 'complete' && t.actualEnd)
      .map(t => new Date(t.actualEnd!).toISOString().split('T')[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse();

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = today;
    for (const d of completedDates) {
      if (d === checkDate) {
        streak++;
        const prev = new Date(checkDate);
        prev.setDate(prev.getDate() - 1);
        checkDate = prev.toISOString().split('T')[0];
      } else if (d < checkDate) {
        break;
      }
    }

    res.json({
      activeProjects: activeProjects.length,
      totalProjects: allProjects.length,
      totalTasks,
      completedTasks,
      completedThisWeek,
      completedThisMonth,
      onTimeStartRate: tasksWithStartData > 0 ? Math.round((startedOnTime / tasksWithStartData) * 100) : 0,
      onTimeCompletionRate: tasksWithCompletionData > 0 ? Math.round((completedOnTime / tasksWithCompletionData) * 100) : 0,
      blockCompletionRate: totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 0,
      totalBlocks,
      doneBlocks,
      skippedBlocks,
      totalFocusMinutes,
      totalEstimatedMinutes: totalEstimated,
      totalActualMinutes: totalActual,
      estimationAccuracy: totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0,
      streak,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// GET /api/analytics/project/:id
router.get('/project/:id', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    const projectBlocks = await db.select().from(timeBlocks).where(eq(timeBlocks.projectId, projectId));
    const projectSessions = await db.select().from(focusSessions).where(eq(focusSessions.projectId, projectId));

    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter(t => t.status === 'complete').length;
    const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.durationEstimate || 0), 0);
    const totalActual = projectTasks.reduce((sum, t) => sum + (t.durationActual || 0), 0);

    const totalBlocks = projectBlocks.filter(b => b.blockType === 'task').length;
    const doneBlocks = projectBlocks.filter(b => b.status === 'done').length;

    // Pace indicator
    const scheduledToDate = projectBlocks
      .filter(b => b.blockType === 'task' && new Date(b.startTime) <= new Date())
      .length * 30;
    const actualToDate = totalActual;

    let pace: 'ahead' | 'on_track' | 'behind' = 'on_track';
    if (scheduledToDate > 0) {
      const ratio = actualToDate / scheduledToDate;
      if (ratio > 1.1) pace = 'ahead';
      else if (ratio < 0.9) pace = 'behind';
    }

    const totalFocusMinutes = projectSessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.actualDuration || 0), 0);

    res.json({
      totalTasks,
      completedTasks,
      completionPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalEstimatedMinutes: totalEstimated,
      totalActualMinutes: totalActual,
      totalBlocks,
      doneBlocks,
      blockCompletionRate: totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 0,
      scheduledToDateMinutes: scheduledToDate,
      actualToDateMinutes: actualToDate,
      pace,
      totalFocusMinutes,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
});

// GET /api/analytics/weekly
router.get('/weekly', async (_req: Request, res: Response) => {
  try {
    const allTasks = await db.select().from(tasks);
    const weeks: Record<string, { completed: number; started: number; onTime: number; total: number }> = {};

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];
      weeks[weekKey] = { completed: 0, started: 0, onTime: 0, total: 0 };
    }

    for (const task of allTasks) {
      if (task.actualEnd) {
        const endDate = new Date(task.actualEnd);
        for (const weekKey of Object.keys(weeks)) {
          const weekStart = new Date(weekKey);
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (endDate >= weekStart && endDate < weekEnd) {
            weeks[weekKey].completed++;
            if (task.completedOnTime) weeks[weekKey].onTime++;
          }
        }
      }
    }

    res.json(Object.entries(weeks).map(([week, data]) => ({ week, ...data })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weekly analytics' });
  }
});

export default router;
