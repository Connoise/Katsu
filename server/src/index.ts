import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';

import projectTypesRouter from './routes/project-types.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import timeBlocksRouter from './routes/time-blocks.js';
import schedulesRouter from './routes/schedules.js';
import focusSessionsRouter from './routes/focus-sessions.js';
import sessionNotesRouter from './routes/session-notes.js';
import analyticsRouter from './routes/analytics.js';
import templatesRouter from './routes/templates.js';
import archiveRouter from './routes/archive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', authMiddleware);

// API Routes
app.use('/api/project-types', projectTypesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/time-blocks', timeBlocksRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/focus-sessions', focusSessionsRouter);
app.use('/api/session-notes', sessionNotesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/archive', archiveRouter);

// Serve static frontend in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Initialize DB and start server
initializeDatabase();
console.log('Database initialized');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Katsu server running on port ${PORT}`);
});

export default app;
