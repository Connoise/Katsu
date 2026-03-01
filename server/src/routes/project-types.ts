import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projectTypes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/project-types
router.get('/', async (_req: Request, res: Response) => {
  try {
    const types = await db.select().from(projectTypes);
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project types' });
  }
});

// POST /api/project-types
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, color } = req.body;
    const id = uuid();
    await db.insert(projectTypes).values({ id, name, slug, color, isDefault: false });
    const created = await db.select().from(projectTypes).where(eq(projectTypes.id, id));
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project type' });
  }
});

// DELETE /api/project-types/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(projectTypes).where(eq(projectTypes.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project type' });
  }
});

export default router;
