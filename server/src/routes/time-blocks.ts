import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { timeBlocks, scheduleDays, tasks, projects } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/time-blocks?scheduleDayId=...&taskId=...&date=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { scheduleDayId, taskId, date } = req.query;
    const conditions = [];

    if (scheduleDayId) conditions.push(eq(timeBlocks.scheduleDayId, scheduleDayId as string));
    if (taskId) conditions.push(eq(timeBlocks.taskId, taskId as string));

    // If date is provided, find the schedule day first
    if (date) {
      const day = await db.select().from(scheduleDays).where(eq(scheduleDays.date, date as string));
      if (day.length > 0) {
        conditions.push(eq(timeBlocks.scheduleDayId, day[0].id));
      } else {
        return res.json([]);
      }
    }

    const result = conditions.length > 0
      ? await db.select().from(timeBlocks).where(and(...conditions)).orderBy(timeBlocks.startTime)
      : await db.select().from(timeBlocks).orderBy(timeBlocks.startTime);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch time blocks' });
  }
});

// POST /api/time-blocks
router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, projectId, scheduleDayId, label, blockType, startTime, endTime, status, notes } = req.body;
    const id = uuid();

    await db.insert(timeBlocks).values({
      id,
      taskId: taskId || null,
      projectId: projectId || null,
      scheduleDayId,
      label: label || null,
      blockType: blockType || 'task',
      startTime,
      endTime,
      status: status || (taskId ? 'assigned' : 'empty'),
      notes: notes || null,
    });

    const created = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create time block' });
  }
});

// POST /api/time-blocks/bulk - Create multiple blocks for a task
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { taskId, projectId, scheduleDayId, startTime, blockCount, blockType } = req.body;
    const created = [];

    let currentStart = new Date(startTime);
    for (let i = 0; i < blockCount; i++) {
      const id = uuid();
      const start = currentStart.toISOString();
      const end = new Date(currentStart.getTime() + 30 * 60000).toISOString();

      await db.insert(timeBlocks).values({
        id,
        taskId: taskId || null,
        projectId: projectId || null,
        scheduleDayId,
        blockType: blockType || 'task',
        startTime: start,
        endTime: end,
        status: taskId ? 'assigned' : 'empty',
      });

      const block = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id));
      created.push(block[0]);
      currentStart = new Date(currentStart.getTime() + 30 * 60000);
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create time blocks' });
  }
});

// PUT /api/time-blocks/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { taskId, projectId, label, blockType, startTime, endTime, status, notes } = req.body;
    const updates: Record<string, any> = {};

    if (taskId !== undefined) updates.taskId = taskId;
    if (projectId !== undefined) updates.projectId = projectId;
    if (label !== undefined) updates.label = label;
    if (blockType !== undefined) updates.blockType = blockType;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    await db.update(timeBlocks).set(updates).where(eq(timeBlocks.id, req.params.id));
    const updated = await db.select().from(timeBlocks).where(eq(timeBlocks.id, req.params.id));

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Time block not found' });
    }

    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update time block' });
  }
});

// DELETE /api/time-blocks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(timeBlocks).where(eq(timeBlocks.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete time block' });
  }
});

export default router;
