import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { archiveRecords, projects, tasks, timeBlocks, sessionNotes, focusSessions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/archive
router.get('/', async (_req: Request, res: Response) => {
  try {
    const records = await db.select().from(archiveRecords).orderBy(desc(archiveRecords.archivedAt));
    res.json(records.map(r => ({
      ...r,
      snapshot: JSON.parse(r.snapshot),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch archive records' });
  }
});

// POST /api/archive/:projectId
router.post('/:projectId', async (req: Request, res: Response) => {
  try {
    const { reason, notes } = req.body;
    const projectId = req.params.projectId;

    // Build snapshot
    const project = await db.select().from(projects).where(eq(projects.id, projectId));
    if (project.length === 0) return res.status(404).json({ error: 'Project not found' });

    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    const projectBlocks = await db.select().from(timeBlocks).where(eq(timeBlocks.projectId, projectId));
    const projectNotes = await db.select().from(sessionNotes).where(eq(sessionNotes.projectId, projectId));
    const projectSessions = await db.select().from(focusSessions).where(eq(focusSessions.projectId, projectId));

    const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.durationEstimate || 0), 0);
    const totalActual = projectTasks.reduce((sum, t) => sum + (t.durationActual || 0), 0);
    const completedTasks = projectTasks.filter(t => t.status === 'complete').length;
    const onTimeTasks = projectTasks.filter(t => t.completedOnTime === true).length;

    const snapshot = {
      project: project[0],
      tasks: projectTasks,
      timeBlocks: projectBlocks,
      sessionNotes: projectNotes,
      focusSessions: projectSessions,
      analytics: {
        totalEstimatedMinutes: totalEstimated,
        totalActualMinutes: totalActual,
        completionRate: projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0,
        onTimeRate: completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 0,
      },
    };

    const id = uuid();
    await db.insert(archiveRecords).values({
      id,
      projectId,
      reason,
      snapshot: JSON.stringify(snapshot),
      notes: notes || null,
    });

    // Update project status
    await db.update(projects).set({
      status: reason === 'complete' ? 'complete' : reason === 'shelved' ? 'shelved' : 'abandoned',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(projects.id, projectId));

    const created = await db.select().from(archiveRecords).where(eq(archiveRecords.id, id));
    res.status(201).json({ ...created[0], snapshot: JSON.parse(created[0].snapshot) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// POST /api/archive/:id/reopen
router.post('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const record = await db.select().from(archiveRecords).where(eq(archiveRecords.id, req.params.id));
    if (record.length === 0) return res.status(404).json({ error: 'Archive record not found' });

    const projectId = record[0].projectId;
    await db.update(projects).set({
      status: 'active',
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(projects.id, projectId));

    await db.delete(archiveRecords).where(eq(archiveRecords.id, req.params.id));
    res.json({ success: true, projectId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reopen project' });
  }
});

export default router;
