# Katsu — Creative Project Manager

A personal creative project management app for solo practitioners who work across multiple disciplines (music production, web development, digital art, writing, etc.). Katsu enforces accountability to creative schedules by tracking task completion, providing focus session timers, and surfacing analytics on productivity patterns.

Single-user, self-hosted. The entire database is a single SQLite file — migration between cloud and local hardware is copying one file.

## Architecture

```
katsu/
├── client/          React + TypeScript SPA (Vite, Tailwind CSS)
├── server/          Node.js + Express REST API
├── data/            SQLite database file (gitignored, auto-created)
├── Dockerfile       Multi-stage production build
└── docker-compose.yml
```

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Frontend       | React 18, TypeScript, Vite        |
| Styling        | Tailwind CSS (dark theme)         |
| Charts         | Recharts                          |
| Icons          | Lucide React                      |
| Routing        | React Router v6                   |
| Backend        | Node.js, Express                  |
| Database       | SQLite via better-sqlite3         |
| ORM            | Drizzle ORM                       |
| Auth           | Bearer token (single-user)        |
| Containerization | Docker + docker-compose         |

## Data Model

All entities are defined in `server/src/db/schema.ts` using Drizzle ORM. The database is auto-initialized on first server start (tables created, default project types seeded).

### Core Entities

- **Projects** — top-level containers with type, status (`active|paused|complete|shelved|abandoned`), priority, deadline, tags
- **Tasks** — units of work within a project; track status transitions (`pending → in_progress → complete`), estimated vs actual duration, on-time metrics
- **TimeBlocks** — 30-minute cells on a daily schedule grid; types: `task|fixed|break|buffer`; assigned to tasks for scheduling
- **ScheduleDays** — daily containers with day type (`workday|weekend|day_off|show_day`), available time window, and associated time blocks
- **ScheduleEntries** — recurrence rules (iCal RRULE) that auto-generate time blocks
- **FocusSessions** — deep work timers (free or pomodoro mode) with pause tracking, linked to tasks
- **SessionNotes** — timestamped journal entries categorized as `idea|decision|blocker|progress|general`, linked to projects/tasks/focus sessions
- **ArchiveRecords** — full JSON snapshots of archived projects with all related data
- **ProjectTemplates / TemplateTasks** — reusable project structures for instantiating new projects
- **Notifications** — log of sent notifications and user responses
- **CalendarSync / CalendarEventMappings** — Google Calendar integration config (future)

### Project Types & Colors

Projects are categorized by type, each with a color used throughout the UI:

| Type              | Slug                | Color   |
|-------------------|---------------------|---------|
| Music Production  | `music_production`  | #FACC15 |
| Web Development   | `web_development`   | #3B82F6 |
| Digital Art       | `digital_art`       | #A855F7 |
| Writing           | `writing`           | #10B981 |
| Video             | `video`             | #EF4444 |
| Performance       | `performance`       | #F59E0B |
| Research          | `research`          | #06B6D4 |
| Hardware          | `hardware`          | #64748B |
| Other             | `other`             | #9CA3AF |

Users can add custom types via the API.

## API Routes

All routes are prefixed with `/api` and accept/return JSON. Auth is via `Authorization: Bearer <token>` header (skipped if `AUTH_TOKEN` env var is not set).

| Method | Path                                    | Description                              |
|--------|-----------------------------------------|------------------------------------------|
| GET    | `/api/project-types`                    | List all project types                   |
| POST   | `/api/project-types`                    | Create custom project type               |
| GET    | `/api/projects`                         | List projects (query: `status`, `type`, `priority`) |
| POST   | `/api/projects`                         | Create project                           |
| GET    | `/api/projects/:id`                     | Get project with tasks                   |
| PUT    | `/api/projects/:id`                     | Update project                           |
| DELETE | `/api/projects/:id`                     | Delete project (cascades tasks)          |
| GET    | `/api/tasks`                            | List tasks (query: `projectId`)          |
| POST   | `/api/tasks`                            | Create task                              |
| GET    | `/api/tasks/:id`                        | Get task with time blocks                |
| PUT    | `/api/tasks/:id`                        | Update task (auto-stamps status times)   |
| DELETE | `/api/tasks/:id`                        | Delete task                              |
| GET    | `/api/time-blocks`                      | List blocks (query: `scheduleDayId`, `taskId`, `date`) |
| POST   | `/api/time-blocks`                      | Create single block                      |
| POST   | `/api/time-blocks/bulk`                 | Create multiple consecutive blocks       |
| PUT    | `/api/time-blocks/:id`                  | Update block                             |
| DELETE | `/api/time-blocks/:id`                  | Delete block                             |
| GET    | `/api/schedules/days`                   | List schedule days (query: `from`, `to`, `date`) |
| POST   | `/api/schedules/days`                   | Create schedule day                      |
| PUT    | `/api/schedules/days/:id`               | Update schedule day                      |
| DELETE | `/api/schedules/days/:id`               | Delete schedule day (cascades blocks)    |
| GET    | `/api/schedules/entries`                | List recurrence entries                  |
| POST   | `/api/schedules/entries`                | Create recurrence entry                  |
| PUT    | `/api/schedules/entries/:id`            | Update recurrence entry                  |
| DELETE | `/api/schedules/entries/:id`            | Delete recurrence entry                  |
| GET    | `/api/focus-sessions`                   | List sessions (query: `taskId`, `projectId`, `status`) |
| POST   | `/api/focus-sessions`                   | Start focus session (auto-stamps task)   |
| PUT    | `/api/focus-sessions/:id`               | Update session (complete logs duration to task) |
| POST   | `/api/focus-sessions/:id/pause`         | Pause active session                     |
| POST   | `/api/focus-sessions/:id/resume`        | Resume paused session                    |
| GET    | `/api/session-notes`                    | List notes (query: `projectId`, `taskId`, `noteType`) |
| POST   | `/api/session-notes`                    | Create note                              |
| PUT    | `/api/session-notes/:id`                | Update note                              |
| DELETE | `/api/session-notes/:id`                | Delete note                              |
| GET    | `/api/analytics/overview`               | Global stats (streaks, rates, totals)    |
| GET    | `/api/analytics/project/:id`            | Per-project analytics with pace indicator |
| GET    | `/api/analytics/weekly`                 | Last 12 weeks completion data            |
| GET    | `/api/templates`                        | List templates with tasks                |
| POST   | `/api/templates`                        | Create template with tasks               |
| POST   | `/api/templates/:id/instantiate`        | Create project from template             |
| POST   | `/api/templates/from-project/:projectId`| Create template from existing project    |
| DELETE | `/api/templates/:id`                    | Delete template                          |
| GET    | `/api/archive`                          | List archive records                     |
| POST   | `/api/archive/:projectId`               | Archive project (snapshots full state)   |
| POST   | `/api/archive/:id/reopen`               | Reopen archived project                  |

## Frontend Pages

| Route               | Page             | Purpose                                          |
|---------------------|------------------|--------------------------------------------------|
| `/`                 | Today View       | Default landing — daily timeline, current block emphasis, quick actions |
| `/dashboard`        | Dashboard        | Project cards grouped by type, overview stats    |
| `/projects`         | Projects         | Project list with create form                    |
| `/projects/:id`     | Project Detail   | Tasks, progress bar, analytics, inline editing   |
| `/calendar`         | Calendar         | Week view grid, block assignment, task selector  |
| `/focus`            | Focus Sessions   | Free/pomodoro timer, quick notes, session history |
| `/notes`            | Session Notes    | Filterable note list, create notes               |
| `/analytics`        | Analytics        | Charts: weekly trends, block distribution, time investment |
| `/templates`        | Templates        | Template library, create/instantiate             |
| `/archive`          | Archive          | Archived projects with snapshots, reopen         |

### Key Frontend Files

- `client/src/types/index.ts` — all TypeScript interfaces, color mappings, enum constants
- `client/src/api/client.ts` — API client functions for every endpoint
- `client/src/utils/time.ts` — date/time formatting, slot generation, week calculation
- `client/src/components/layout/` — `AppLayout`, `Sidebar` (desktop), `BottomNav` (mobile)
- `client/src/components/projects/` — `ProjectCard`, `ProjectForm`
- `client/src/components/tasks/` — `TaskList` (status toggling, inline add, focus launch)

## Running Locally

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
cd server && npm install && cd ../client && npm install && cd ..

# Start the backend (port 3000)
cd server && npm run dev

# In another terminal, start the frontend (port 5173, proxies /api to :3000)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

### Production (Docker)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env — set AUTH_TOKEN for security

# Build and run
docker-compose up -d

# Access at http://localhost:3000
```

### Production (Manual)

```bash
cd client && npm install && npm run build && cd ..
cd server && npm install && npm run build && cd ..
cd server && NODE_ENV=production node dist/index.js
# Serves both API and built frontend on port 3000
```

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable          | Default              | Description                          |
|-------------------|----------------------|--------------------------------------|
| `PORT`            | `3000`               | Server port                          |
| `DB_PATH`         | `./data/katsu.db`    | SQLite database file path            |
| `AUTH_TOKEN`      | (none)               | Bearer token for API auth; if unset, auth is disabled |
| `NODE_ENV`        | `development`        | Set to `production` for optimized serving |

## Design Decisions

- **SQLite over Postgres** — single-user app; the DB is one file, making backup and migration trivial
- **30-minute block granularity** — fixed block size simplifies the grid and keeps mobile usable
- **Tasks and TimeBlocks are separate** — tasks define *what*, blocks define *when*; a task can span many blocks across many days
- **Session labels are computed** — "Session 5/8" is derived at query time from block counts, not stored
- **Status transitions are explicit** — task status changes are driven by user action, not silent automation
- **Dark theme** — the UI uses a dark color scheme (bg `#0f0f0f`, surfaces `#1a1a1a`–`#2e2e2e`, accent `#FACC15`)
- **Mobile-first responsive** — sidebar navigation on desktop, bottom tab bar on mobile; no drag-and-drop on mobile

## Development Roadmap

The full specification is in `katsu-plan (1).md`. Remaining work:

- **Push notifications** — Web Push API (VAPID) + Ntfy.sh integration with action buttons
- **Recurrence generation** — node-cron job to generate TimeBlocks from ScheduleEntry rules
- **Google Calendar sync** — bidirectional sync via Google Calendar API v3
- **CSV import/export** — bulk data operations
- **PWA service worker** — offline support with action queueing
- **Drag-and-drop** — desktop block rearrangement on the calendar grid
