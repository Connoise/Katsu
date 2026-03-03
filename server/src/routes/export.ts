import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projects, tasks, timeBlocks, scheduleDays } from '../db/schema.js';

const router = Router();

function toCsv(rows: any[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

// GET /api/export/projects
router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const data = await db.select().from(projects);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="katsu-projects.csv"');
    res.send(toCsv(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export projects' });
  }
});

// GET /api/export/tasks
router.get('/tasks', async (_req: Request, res: Response) => {
  try {
    const data = await db.select().from(tasks);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="katsu-tasks.csv"');
    res.send(toCsv(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export tasks' });
  }
});

// GET /api/export/time-blocks
router.get('/time-blocks', async (_req: Request, res: Response) => {
  try {
    const data = await db.select().from(timeBlocks);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="katsu-time-blocks.csv"');
    res.send(toCsv(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export time blocks' });
  }
});

// GET /api/export/schedule
router.get('/schedule', async (_req: Request, res: Response) => {
  try {
    const data = await db.select().from(scheduleDays);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="katsu-schedule.csv"');
    res.send(toCsv(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export schedule' });
  }
});

export default router;
