import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/index.js';
import { authMiddleware, loginHandler, setPasswordHandler } from './middleware/auth.js';
import { startNotificationService } from './services/telegram.js';

import projectTypesRouter from './routes/project-types.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import timeBlocksRouter from './routes/time-blocks.js';
import schedulesRouter from './routes/schedules.js';
import focusSessionsRouter from './routes/focus-sessions.js';
import sessionNotesRouter from './routes/session-notes.js';
import analyticsRouter from './routes/analytics.js';
import templatesRouter from './routes/templates.js';
import scheduleTemplatesRouter from './routes/schedule-templates.js';
import archiveRouter from './routes/archive.js';
import settingsRouter from './routes/settings.js';
import exportRouter from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Auth login endpoint (before auth middleware)
app.post('/api/auth/login', express.json(), loginHandler);
app.post('/api/auth/set-password', express.json(), setPasswordHandler);

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
app.use('/api/schedule-templates', scheduleTemplatesRouter);
app.use('/api/archive', archiveRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportRouter);

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
  startNotificationService();
});

export default app;
