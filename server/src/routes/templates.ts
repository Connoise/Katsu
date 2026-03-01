import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projectTemplates, templateTasks, projects, tasks } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await db.select().from(projectTemplates);
    const enriched = await Promise.all(templates.map(async (tmpl) => {
      const tmplTasks = await db.select().from(templateTasks)
        .where(eq(templateTasks.templateId, tmpl.id))
        .orderBy(templateTasks.order);
      const totalEstimatedHrs = tmplTasks.reduce((sum, t) => sum + (t.durationEstimate || 0), 0) / 60;
      return {
        ...tmpl,
        defaultTags: JSON.parse(tmpl.defaultTags || '[]'),
        tasks: tmplTasks,
        totalEstimatedHrs: Math.round(totalEstimatedHrs * 10) / 10,
      };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(projectTemplates).where(eq(projectTemplates.id, req.params.id));
    if (result.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tmplTasks = await db.select().from(templateTasks)
      .where(eq(templateTasks.templateId, req.params.id))
      .orderBy(templateTasks.order);

    res.json({
      ...result[0],
      defaultTags: JSON.parse(result[0].defaultTags || '[]'),
      tasks: tmplTasks.map(t => ({
        ...t,
        dependsOnOrder: JSON.parse(t.dependsOnOrder || '[]'),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, projectType, defaultTags, tasks: tmplTasks } = req.body;
    const id = uuid();

    await db.insert(projectTemplates).values({
      id,
      name,
      description: description || null,
      projectType,
      defaultTags: JSON.stringify(defaultTags || []),
    });

    if (tmplTasks && tmplTasks.length > 0) {
      for (const task of tmplTasks) {
        await db.insert(templateTasks).values({
          id: uuid(),
          templateId: id,
          name: task.name,
          description: task.description || null,
          category: task.category || null,
          order: task.order || 0,
          durationEstimate: task.durationEstimate || null,
          sessionCount: task.sessionCount || null,
          isMilestone: task.isMilestone || false,
          dependsOnOrder: JSON.stringify(task.dependsOnOrder || []),
          notes: task.notes || null,
        });
      }
    }

    const created = await db.select().from(projectTemplates).where(eq(projectTemplates.id, id));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// POST /api/templates/:id/instantiate
router.post('/:id/instantiate', async (req: Request, res: Response) => {
  try {
    const { projectName, startDate, targetDeadline } = req.body;
    const template = await db.select().from(projectTemplates).where(eq(projectTemplates.id, req.params.id));
    if (template.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tmpl = template[0];
    const tmplTasks = await db.select().from(templateTasks)
      .where(eq(templateTasks.templateId, tmpl.id))
      .orderBy(templateTasks.order);

    // Create project
    const projectId = uuid();
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await db.insert(projects).values({
      id: projectId,
      name: projectName,
      slug,
      projectType: tmpl.projectType,
      tags: tmpl.defaultTags,
      targetDeadline: targetDeadline || null,
    });

    // Create tasks from template tasks
    for (const tt of tmplTasks) {
      await db.insert(tasks).values({
        id: uuid(),
        projectId,
        templateTaskId: tt.id,
        name: tt.name,
        description: tt.description,
        order: tt.order,
        durationEstimate: tt.durationEstimate,
        isMilestone: tt.isMilestone,
        notes: tt.notes,
      });
    }

    const project = await db.select().from(projects).where(eq(projects.id, projectId));
    res.status(201).json(project[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to instantiate template' });
  }
});

// POST /api/templates/from-project/:projectId
router.post('/from-project/:projectId', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const project = await db.select().from(projects).where(eq(projects.id, req.params.projectId));
    if (project.length === 0) return res.status(404).json({ error: 'Project not found' });

    const proj = project[0];
    const projectTasks = await db.select().from(tasks)
      .where(eq(tasks.projectId, proj.id))
      .orderBy(tasks.order);

    const templateId = uuid();
    await db.insert(projectTemplates).values({
      id: templateId,
      name: name || `${proj.name} Template`,
      description: proj.description,
      projectType: proj.projectType,
      defaultTags: proj.tags,
      createdFromId: proj.id,
    });

    for (const task of projectTasks) {
      await db.insert(templateTasks).values({
        id: uuid(),
        templateId,
        name: task.name,
        description: task.description,
        order: task.order,
        durationEstimate: task.durationEstimate,
        isMilestone: task.isMilestone,
        notes: task.notes,
      });
    }

    const created = await db.select().from(projectTemplates).where(eq(projectTemplates.id, templateId));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template from project' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(projectTemplates).where(eq(projectTemplates.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
