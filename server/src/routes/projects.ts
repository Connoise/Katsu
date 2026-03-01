import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projects, tasks, timeBlocks } from '../db/schema.js';
import { eq, desc, sql, and, ne } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, type, priority } = req.query;
    let query = db.select().from(projects);

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(projects.status, status as any));
    } else {
      // By default, exclude archived
      conditions.push(ne(projects.status, 'abandoned' as any));
    }
    if (type) conditions.push(eq(projects.projectType, type as string));
    if (priority) conditions.push(eq(projects.priority, priority as any));

    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(projects.updatedAt))
      : await query.orderBy(desc(projects.updatedAt));

    // Compute completion percentages
    const enriched = await Promise.all(result.map(async (project) => {
      const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, project.id));
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === 'complete').length;
      const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.durationEstimate || 0), 0);
      const totalActual = projectTasks.reduce((sum, t) => sum + (t.durationActual || 0), 0);

      return {
        ...project,
        tags: JSON.parse(project.tags || '[]'),
        completionPercent,
        totalTasks,
        completedTasks,
        totalEstimatedMinutes: totalEstimated,
        totalActualMinutes: totalActual,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(projects).where(eq(projects.id, req.params.id));
    if (result.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = result[0];
    const projectTasks = await db.select().from(tasks)
      .where(eq(tasks.projectId, project.id))
      .orderBy(tasks.order);

    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter(t => t.status === 'complete').length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.durationEstimate || 0), 0);
    const totalActual = projectTasks.reduce((sum, t) => sum + (t.durationActual || 0), 0);

    res.json({
      ...project,
      tags: JSON.parse(project.tags || '[]'),
      tasks: projectTasks.map(t => ({ ...t, dependsOn: JSON.parse(t.dependsOn || '[]') })),
      completionPercent,
      totalTasks,
      completedTasks,
      totalEstimatedMinutes: totalEstimated,
      totalActualMinutes: totalActual,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, projectType, status, priority, targetDeadline, tags, notes } = req.body;
    const id = uuid();
    const slug = slugify(name);

    await db.insert(projects).values({
      id,
      name,
      slug,
      description: description || null,
      projectType,
      status: status || 'active',
      priority: priority || 'medium',
      targetDeadline: targetDeadline || null,
      tags: JSON.stringify(tags || []),
      notes: notes || null,
    });

    const created = await db.select().from(projects).where(eq(projects.id, id));
    res.status(201).json({ ...created[0], tags: JSON.parse(created[0].tags || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, projectType, status, priority, targetDeadline, tags, notes } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (name !== undefined) { updates.name = name; updates.slug = slugify(name); }
    if (description !== undefined) updates.description = description;
    if (projectType !== undefined) updates.projectType = projectType;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (targetDeadline !== undefined) updates.targetDeadline = targetDeadline;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    if (notes !== undefined) updates.notes = notes;

    await db.update(projects).set(updates).where(eq(projects.id, req.params.id));
    const updated = await db.select().from(projects).where(eq(projects.id, req.params.id));

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ ...updated[0], tags: JSON.parse(updated[0].tags || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(projects).where(eq(projects.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
