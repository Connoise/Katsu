import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { sessionNotes } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/session-notes?projectId=...&taskId=...&noteType=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, taskId, focusSessionId, noteType } = req.query;
    const conditions = [];

    if (projectId) conditions.push(eq(sessionNotes.projectId, projectId as string));
    if (taskId) conditions.push(eq(sessionNotes.taskId, taskId as string));
    if (focusSessionId) conditions.push(eq(sessionNotes.focusSessionId, focusSessionId as string));
    if (noteType) conditions.push(eq(sessionNotes.noteType, noteType as any));

    const result = conditions.length > 0
      ? await db.select().from(sessionNotes).where(and(...conditions)).orderBy(desc(sessionNotes.createdAt))
      : await db.select().from(sessionNotes).orderBy(desc(sessionNotes.createdAt));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session notes' });
  }
});

// POST /api/session-notes
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, taskId, focusSessionId, content, noteType } = req.body;
    const id = uuid();

    await db.insert(sessionNotes).values({
      id,
      projectId,
      taskId: taskId || null,
      focusSessionId: focusSessionId || null,
      content,
      noteType: noteType || 'general',
    });

    const created = await db.select().from(sessionNotes).where(eq(sessionNotes.id, id));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session note' });
  }
});

// PUT /api/session-notes/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { content, noteType } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (content !== undefined) updates.content = content;
    if (noteType !== undefined) updates.noteType = noteType;

    await db.update(sessionNotes).set(updates).where(eq(sessionNotes.id, req.params.id));
    const updated = await db.select().from(sessionNotes).where(eq(sessionNotes.id, req.params.id));
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update session note' });
  }
});

// DELETE /api/session-notes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(sessionNotes).where(eq(sessionNotes.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session note' });
  }
});

export default router;
