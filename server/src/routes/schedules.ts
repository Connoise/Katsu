import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { scheduleDays, timeBlocks, scheduleEntries } from '../db/schema.js';
import { eq, and, between, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// ─── Schedule Days ──────────────────────────────────────────────

// GET /api/schedule-days?from=...&to=...
router.get('/days', async (req: Request, res: Response) => {
  try {
    const { from, to, date } = req.query;

    if (date) {
      const result = await db.select().from(scheduleDays).where(eq(scheduleDays.date, date as string));
      if (result.length === 0) {
        return res.json(null);
      }
      const blocks = await db.select().from(timeBlocks)
        .where(eq(timeBlocks.scheduleDayId, result[0].id))
        .orderBy(timeBlocks.startTime);
      return res.json({ ...result[0], timeBlocks: blocks });
    }

    if (from && to) {
      const result = await db.select().from(scheduleDays)
        .where(between(scheduleDays.date, from as string, to as string))
        .orderBy(scheduleDays.date);
      return res.json(result);
    }

    const result = await db.select().from(scheduleDays).orderBy(scheduleDays.date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule days' });
  }
});

// GET /api/schedule-days/:id
router.get('/days/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(scheduleDays).where(eq(scheduleDays.id, req.params.id));
    if (result.length === 0) {
      return res.status(404).json({ error: 'Schedule day not found' });
    }

    const blocks = await db.select().from(timeBlocks)
      .where(eq(timeBlocks.scheduleDayId, result[0].id))
      .orderBy(timeBlocks.startTime);

    const taskBlocks = blocks.filter(b => b.blockType === 'task');
    const fixedBlocks = blocks.filter(b => b.blockType === 'fixed' || b.blockType === 'break');

    const totalAvailable = computeAvailableMinutes(result[0].availableStart, result[0].availableEnd)
      - fixedBlocks.length * 30;
    const totalScheduled = taskBlocks.length * 30;

    res.json({
      ...result[0],
      timeBlocks: blocks,
      totalAvailableMinutes: totalAvailable,
      totalScheduledMinutes: totalScheduled,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule day' });
  }
});

// POST /api/schedule-days
router.post('/days', async (req: Request, res: Response) => {
  try {
    const { date, dayType, title, subtitle, availableStart, availableEnd, notes } = req.body;
    const id = uuid();

    // Determine day type from date if not provided
    let type = dayType;
    if (!type) {
      const dayOfWeek = new Date(date).getDay();
      type = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'workday';
    }

    const defaultStart = type === 'workday' ? '17:00' : '08:30';
    const defaultEnd = type === 'workday' ? '23:00' : '01:00';

    await db.insert(scheduleDays).values({
      id,
      date,
      dayType: type,
      title: title || null,
      subtitle: subtitle || null,
      availableStart: availableStart || defaultStart,
      availableEnd: availableEnd || defaultEnd,
      notes: notes || null,
    });

    const created = await db.select().from(scheduleDays).where(eq(scheduleDays.id, id));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule day' });
  }
});

// PUT /api/schedule-days/:id
router.put('/days/:id', async (req: Request, res: Response) => {
  try {
    const { dayType, title, subtitle, availableStart, availableEnd, notes } = req.body;
    const updates: Record<string, any> = {};

    if (dayType !== undefined) updates.dayType = dayType;
    if (title !== undefined) updates.title = title;
    if (subtitle !== undefined) updates.subtitle = subtitle;
    if (availableStart !== undefined) updates.availableStart = availableStart;
    if (availableEnd !== undefined) updates.availableEnd = availableEnd;
    if (notes !== undefined) updates.notes = notes;

    await db.update(scheduleDays).set(updates).where(eq(scheduleDays.id, req.params.id));
    const updated = await db.select().from(scheduleDays).where(eq(scheduleDays.id, req.params.id));
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule day' });
  }
});

// DELETE /api/schedule-days/:id
router.delete('/days/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(scheduleDays).where(eq(scheduleDays.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule day' });
  }
});

// ─── Schedule Entries (Recurrence) ──────────────────────────────

// GET /api/schedule-entries
router.get('/entries', async (_req: Request, res: Response) => {
  try {
    const result = await db.select().from(scheduleEntries);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule entries' });
  }
});

// POST /api/schedule-entries
router.post('/entries', async (req: Request, res: Response) => {
  try {
    const { taskId, projectId, title, blockType, recurrenceRule, startTime, endTime, reminderOffset } = req.body;
    const id = uuid();

    await db.insert(scheduleEntries).values({
      id,
      taskId: taskId || null,
      projectId: projectId || null,
      title,
      blockType,
      recurrenceRule,
      startTime,
      endTime,
      reminderOffset: reminderOffset || 5,
    });

    const created = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, id));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule entry' });
  }
});

// PUT /api/schedule-entries/:id
router.put('/entries/:id', async (req: Request, res: Response) => {
  try {
    const updates: Record<string, any> = {};
    const { title, blockType, recurrenceRule, startTime, endTime, reminderOffset, active } = req.body;

    if (title !== undefined) updates.title = title;
    if (blockType !== undefined) updates.blockType = blockType;
    if (recurrenceRule !== undefined) updates.recurrenceRule = recurrenceRule;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (reminderOffset !== undefined) updates.reminderOffset = reminderOffset;
    if (active !== undefined) updates.active = active;

    await db.update(scheduleEntries).set(updates).where(eq(scheduleEntries.id, req.params.id));
    const updated = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, req.params.id));
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule entry' });
  }
});

// DELETE /api/schedule-entries/:id
router.delete('/entries/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(scheduleEntries).where(eq(scheduleEntries.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule entry' });
  }
});

function computeAvailableMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // Handle overnight
  return endMin - startMin;
}

export default router;
