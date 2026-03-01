import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { focusSessions, tasks, sessionNotes } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/focus-sessions?taskId=...&projectId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { taskId, projectId, status } = req.query;
    const conditions = [];

    if (taskId) conditions.push(eq(focusSessions.taskId, taskId as string));
    if (projectId) conditions.push(eq(focusSessions.projectId, projectId as string));
    if (status) conditions.push(eq(focusSessions.status, status as any));

    const result = conditions.length > 0
      ? await db.select().from(focusSessions).where(and(...conditions)).orderBy(desc(focusSessions.startedAt))
      : await db.select().from(focusSessions).orderBy(desc(focusSessions.startedAt));

    res.json(result.map(s => ({ ...s, pauses: JSON.parse(s.pauses || '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch focus sessions' });
  }
});

// GET /api/focus-sessions/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
    if (result.length === 0) {
      return res.status(404).json({ error: 'Focus session not found' });
    }

    const session = result[0];
    const notes = await db.select().from(sessionNotes)
      .where(eq(sessionNotes.focusSessionId, session.id))
      .orderBy(sessionNotes.createdAt);

    res.json({
      ...session,
      pauses: JSON.parse(session.pauses || '[]'),
      notes,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch focus session' });
  }
});

// POST /api/focus-sessions
router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, projectId, mode, targetDuration } = req.body;
    const id = uuid();

    await db.insert(focusSessions).values({
      id,
      taskId,
      projectId,
      mode: mode || 'free',
      targetDuration: targetDuration || null,
      startedAt: new Date().toISOString(),
    });

    // Auto-stamp task actual_start if not already set
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (task[0] && !task[0].actualStart) {
      await db.update(tasks).set({
        actualStart: new Date().toISOString(),
        status: 'in_progress',
        updatedAt: new Date().toISOString(),
      }).where(eq(tasks.id, taskId));
    }

    const created = await db.select().from(focusSessions).where(eq(focusSessions.id, id));
    res.status(201).json({ ...created[0], pauses: JSON.parse(created[0].pauses || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create focus session' });
  }
});

// PUT /api/focus-sessions/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { status, endedAt, actualDuration, breakDuration, pomodoroCount, pauses, syncStatus } = req.body;
    const updates: Record<string, any> = {};

    if (status !== undefined) updates.status = status;
    if (endedAt !== undefined) updates.endedAt = endedAt;
    if (actualDuration !== undefined) updates.actualDuration = actualDuration;
    if (breakDuration !== undefined) updates.breakDuration = breakDuration;
    if (pomodoroCount !== undefined) updates.pomodoroCount = pomodoroCount;
    if (pauses !== undefined) updates.pauses = JSON.stringify(pauses);
    if (syncStatus !== undefined) updates.syncStatus = syncStatus;

    // If completing, log duration to task
    if (status === 'completed' && actualDuration) {
      const session = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
      if (session[0]) {
        const task = await db.select().from(tasks).where(eq(tasks.id, session[0].taskId));
        if (task[0]) {
          await db.update(tasks).set({
            durationActual: (task[0].durationActual || 0) + actualDuration,
            updatedAt: new Date().toISOString(),
          }).where(eq(tasks.id, session[0].taskId));
        }
      }
    }

    await db.update(focusSessions).set(updates).where(eq(focusSessions.id, req.params.id));
    const updated = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
    res.json({ ...updated[0], pauses: JSON.parse(updated[0].pauses || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update focus session' });
  }
});

// POST /api/focus-sessions/:id/pause
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const session = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
    if (session.length === 0) return res.status(404).json({ error: 'Session not found' });

    const pauses = JSON.parse(session[0].pauses || '[]');
    pauses.push({ pausedAt: new Date().toISOString(), resumedAt: null });

    await db.update(focusSessions).set({
      pauses: JSON.stringify(pauses),
      status: 'paused',
    }).where(eq(focusSessions.id, req.params.id));

    const updated = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
    res.json({ ...updated[0], pauses: JSON.parse(updated[0].pauses || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause focus session' });
  }
});

// POST /api/focus-sessions/:id/resume
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const session = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
    if (session.length === 0) return res.status(404).json({ error: 'Session not found' });

    const pauses = JSON.parse(session[0].pauses || '[]');
    if (pauses.length > 0 && !pauses[pauses.length - 1].resumedAt) {
      pauses[pauses.length - 1].resumedAt = new Date().toISOString();
    }

    await db.update(focusSessions).set({
      pauses: JSON.stringify(pauses),
      status: 'active',
    }).where(eq(focusSessions.id, req.params.id));

    const updated = await db.select().from(focusSessions).where(eq(focusSessions.id, req.params.id));
    res.json({ ...updated[0], pauses: JSON.parse(updated[0].pauses || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume focus session' });
  }
});

export default router;
