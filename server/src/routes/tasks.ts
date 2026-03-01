import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { tasks, timeBlocks } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/tasks?projectId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const conditions = projectId ? [eq(tasks.projectId, projectId as string)] : [];
    const result = conditions.length > 0
      ? await db.select().from(tasks).where(and(...conditions)).orderBy(tasks.order)
      : await db.select().from(tasks).orderBy(tasks.order);

    const enriched = await Promise.all(result.map(async (task) => {
      const blocks = await db.select().from(timeBlocks).where(eq(timeBlocks.taskId, task.id));
      const blocksAssigned = blocks.length;
      const blocksCompleted = blocks.filter(b => b.status === 'done').length;

      return {
        ...task,
        dependsOn: JSON.parse(task.dependsOn || '[]'),
        blocksAssigned,
        blocksCompleted,
        sessionLabel: blocksAssigned > 0 ? `Session ${blocksCompleted}/${blocksAssigned}` : null,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
    if (result.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result[0];
    const blocks = await db.select().from(timeBlocks).where(eq(timeBlocks.taskId, task.id));
    const blocksAssigned = blocks.length;
    const blocksCompleted = blocks.filter(b => b.status === 'done').length;

    res.json({
      ...task,
      dependsOn: JSON.parse(task.dependsOn || '[]'),
      blocksAssigned,
      blocksCompleted,
      sessionLabel: blocksAssigned > 0 ? `Session ${blocksCompleted}/${blocksAssigned}` : null,
      timeBlocks: blocks,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      projectId, name, description, status, order,
      durationEstimate, isMilestone, dependsOn, notes
    } = req.body;

    const id = uuid();

    // Get the next order if not provided
    let taskOrder = order;
    if (taskOrder === undefined) {
      const maxOrder = await db.select({ max: sql<number>`MAX("order")` })
        .from(tasks).where(eq(tasks.projectId, projectId));
      taskOrder = (maxOrder[0]?.max || 0) + 1;
    }

    await db.insert(tasks).values({
      id,
      projectId,
      name,
      description: description || null,
      status: status || 'pending',
      order: taskOrder,
      durationEstimate: durationEstimate || null,
      isMilestone: isMilestone || false,
      dependsOn: JSON.stringify(dependsOn || []),
      notes: notes || null,
    });

    const created = await db.select().from(tasks).where(eq(tasks.id, id));
    res.status(201).json({ ...created[0], dependsOn: JSON.parse(created[0].dependsOn || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const {
      name, description, status, order,
      scheduledStart, scheduledEnd, actualStart, actualEnd,
      durationEstimate, durationActual, isMilestone, dependsOn, notes
    } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (order !== undefined) updates.order = order;
    if (scheduledStart !== undefined) updates.scheduledStart = scheduledStart;
    if (scheduledEnd !== undefined) updates.scheduledEnd = scheduledEnd;
    if (durationEstimate !== undefined) updates.durationEstimate = durationEstimate;
    if (durationActual !== undefined) updates.durationActual = durationActual;
    if (isMilestone !== undefined) updates.isMilestone = isMilestone;
    if (dependsOn !== undefined) updates.dependsOn = JSON.stringify(dependsOn);
    if (notes !== undefined) updates.notes = notes;

    // Handle status transitions
    if (status !== undefined) {
      updates.status = status;
      if (status === 'in_progress' && actualStart === undefined) {
        const current = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
        if (current[0] && !current[0].actualStart) {
          updates.actualStart = new Date().toISOString();
          if (current[0].scheduledStart) {
            updates.startedOnTime = new Date(updates.actualStart) <= new Date(current[0].scheduledStart);
          }
        }
      }
      if (status === 'complete' && actualEnd === undefined) {
        updates.actualEnd = new Date().toISOString();
        const current = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
        if (current[0] && current[0].scheduledEnd) {
          updates.completedOnTime = new Date(updates.actualEnd) <= new Date(current[0].scheduledEnd);
        }
      }
    }

    if (actualStart !== undefined) updates.actualStart = actualStart;
    if (actualEnd !== undefined) updates.actualEnd = actualEnd;

    await db.update(tasks).set(updates).where(eq(tasks.id, req.params.id));
    const updated = await db.select().from(tasks).where(eq(tasks.id, req.params.id));

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ ...updated[0], dependsOn: JSON.parse(updated[0].dependsOn || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PUT /api/tasks/:id/reorder
router.put('/:id/reorder', async (req: Request, res: Response) => {
  try {
    const { newOrder } = req.body;
    await db.update(tasks).set({ order: newOrder }).where(eq(tasks.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(tasks).where(eq(tasks.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
