import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { scheduleTemplates, scheduleTemplateBlocks, scheduleDays, timeBlocks } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/schedule-templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await db.select().from(scheduleTemplates);
    const enriched = await Promise.all(templates.map(async (tmpl) => {
      const blocks = await db.select().from(scheduleTemplateBlocks)
        .where(eq(scheduleTemplateBlocks.templateId, tmpl.id))
        .orderBy(scheduleTemplateBlocks.startTime);
      return { ...tmpl, blocks };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule templates' });
  }
});

// GET /api/schedule-templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, req.params.id));
    if (result.length === 0) return res.status(404).json({ error: 'Template not found' });

    const blocks = await db.select().from(scheduleTemplateBlocks)
      .where(eq(scheduleTemplateBlocks.templateId, req.params.id))
      .orderBy(scheduleTemplateBlocks.startTime);

    res.json({ ...result[0], blocks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule template' });
  }
});

// POST /api/schedule-templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, dayType, blocks } = req.body;
    const id = uuid();

    await db.insert(scheduleTemplates).values({
      id,
      name,
      description: description || null,
      dayType: dayType || 'workday',
    });

    if (blocks && blocks.length > 0) {
      for (const block of blocks) {
        await db.insert(scheduleTemplateBlocks).values({
          id: uuid(),
          templateId: id,
          label: block.label,
          blockType: block.blockType || 'fixed',
          startTime: block.startTime,
          endTime: block.endTime,
        });
      }
    }

    const created = await db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, id));
    const createdBlocks = await db.select().from(scheduleTemplateBlocks)
      .where(eq(scheduleTemplateBlocks.templateId, id))
      .orderBy(scheduleTemplateBlocks.startTime);

    res.status(201).json({ ...created[0], blocks: createdBlocks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule template' });
  }
});

// POST /api/schedule-templates/:id/apply
router.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const template = await db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, req.params.id));
    if (template.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tmpl = template[0];
    const tmplBlocks = await db.select().from(scheduleTemplateBlocks)
      .where(eq(scheduleTemplateBlocks.templateId, tmpl.id))
      .orderBy(scheduleTemplateBlocks.startTime);

    // Find or create the schedule day
    let existingDay = await db.select().from(scheduleDays).where(eq(scheduleDays.date, date));
    let dayId: string;

    if (existingDay.length === 0) {
      dayId = uuid();
      await db.insert(scheduleDays).values({
        id: dayId,
        date,
        dayType: tmpl.dayType,
        availableStart: '00:00',
        availableEnd: '23:30',
      });
    } else {
      dayId = existingDay[0].id;
      // Update day type to match template
      await db.update(scheduleDays).set({ dayType: tmpl.dayType }).where(eq(scheduleDays.id, dayId));
    }

    // Create time blocks from template blocks
    for (const block of tmplBlocks) {
      await db.insert(timeBlocks).values({
        id: uuid(),
        scheduleDayId: dayId,
        label: block.label,
        blockType: block.blockType,
        startTime: `${date}T${block.startTime}:00`,
        endTime: `${date}T${block.endTime}:00`,
        status: 'empty',
      });
    }

    const day = await db.select().from(scheduleDays).where(eq(scheduleDays.id, dayId));
    const dayBlocks = await db.select().from(timeBlocks)
      .where(eq(timeBlocks.scheduleDayId, dayId))
      .orderBy(timeBlocks.startTime);

    res.json({ ...day[0], timeBlocks: dayBlocks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// POST /api/schedule-templates/from-day/:dayId — create template from existing day
router.post('/from-day/:dayId', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const dayResult = await db.select().from(scheduleDays).where(eq(scheduleDays.id, req.params.dayId));
    if (dayResult.length === 0) return res.status(404).json({ error: 'Day not found' });

    const day = dayResult[0];
    const dayBlocks = await db.select().from(timeBlocks)
      .where(eq(timeBlocks.scheduleDayId, day.id))
      .orderBy(timeBlocks.startTime);

    const templateId = uuid();
    await db.insert(scheduleTemplates).values({
      id: templateId,
      name: name || `Template from ${day.date}`,
      dayType: day.dayType,
    });

    for (const block of dayBlocks) {
      await db.insert(scheduleTemplateBlocks).values({
        id: uuid(),
        templateId,
        label: block.label || block.blockType,
        blockType: block.blockType,
        startTime: block.startTime.split('T')[1]?.substring(0, 5) || block.startTime,
        endTime: block.endTime.split('T')[1]?.substring(0, 5) || block.endTime,
      });
    }

    const created = await db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, templateId));
    const createdBlocks = await db.select().from(scheduleTemplateBlocks)
      .where(eq(scheduleTemplateBlocks.templateId, templateId))
      .orderBy(scheduleTemplateBlocks.startTime);

    res.status(201).json({ ...created[0], blocks: createdBlocks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template from day' });
  }
});

// DELETE /api/schedule-templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(scheduleTemplates).where(eq(scheduleTemplates.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
