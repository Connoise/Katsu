# Katsu — Creative Project Manager

## Overview

Katsu is a personal creative project management application designed for a solo creative practitioner who works across multiple disciplines (music production, web development, digital art, writing, etc.). The app enforces accountability to creative schedules by tracking task completion, sending push notifications, and surfacing analytics on productivity patterns.

**Primary User:** Single user (self-hosted, personal use)
**Target Platforms:** Web app (responsive/mobile-friendly) with push notifications to mobile devices
**Deployment Strategy:** Cloud-hosted service initially (e.g., Railway, Fly.io, or a VPS), with architecture designed for easy migration to a local self-hosted server (Docker-based)

---

## Architecture

### Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Familiar stack; responsive SPA with mobile-first design |
| UI Framework | Tailwind CSS + shadcn/ui | Clean, fast UI development |
| Backend | Node.js + Express (or Fastify) | Lightweight, pairs with React ecosystem |
| Database | SQLite (via better-sqlite3 or Drizzle ORM) | Zero-config, file-based — trivial to move between cloud and local server |
| Push Notifications | Web Push API (VAPID) + optional Ntfy.sh | Browser-native push; Ntfy.sh as a lightweight fallback for mobile without installing a full PWA |
| Scheduler/Cron | node-cron or BullMQ (with Redis) | Timed notification dispatch and schedule checks |
| Auth | Simple token/passphrase (single-user) | No need for full OAuth; just protect the instance |
| Containerization | Docker + docker-compose | Enables identical deployment on cloud or local hardware |

### Deployment Path

```
Phase 1 (Now):   Cloud VPS or Railway/Fly.io → Docker container
Phase 2 (Future): Pull same Docker image → run on local Lenovo ThinkCentre homelab
                   Reverse proxy via Caddy or nginx for LAN/Tailnet access
```

SQLite is the key architectural choice here — the entire database is a single file. Migration from cloud to local server is literally copying one file.

---

## Data Model

### Projects

```
Project {
  id                  UUID
  name                string
  slug                string (URL-friendly)
  description         text (optional)
  project_type        enum → see Project Types
  status              enum: active | paused | complete | shelved | abandoned
  priority            enum: low | medium | high | urgent
  created_at          datetime
  updated_at          datetime
  archived_at         datetime (nullable)
  target_deadline     datetime (nullable — overall project deadline)
  completion_percent  float (computed from tasks)
  tags                string[] (flexible labels)
  notes               text (freeform project notes)
  parent_project_id   UUID (nullable — for sub-projects or cloned lineage)
  cloned_from_id      UUID (nullable — reference to source project if cloned)
}
```

### Project Types & Color Mapping

Predefined but user-extensible categories. Each type has a color used to visually distinguish task blocks on the schedule grid and dashboard. Colors are applied at the project-type level — all tasks belonging to a music project are yellow, all web dev tasks are blue, etc.

| Type | Slug | Color | Hex |
|---|---|---|---|
| Music Production | `music_production` | Yellow | `#FACC15` |
| Web Development | `web_development` | Blue | `#3B82F6` |
| Digital Art | `digital_art` | Purple | `#A855F7` |
| Writing | `writing` | Emerald | `#10B981` |
| Video | `video` | Red | `#EF4444` |
| Performance | `performance` | Gold | `#F59E0B` |
| Research | `research` | Cyan | `#06B6D4` |
| Hardware | `hardware` | Slate | `#64748B` |
| Other | `other` | Gray | `#9CA3AF` |

Non-task blocks (breaks, work hours, buffer) use neutral tones:
- `fixed` blocks (work, events): Dark Gray `#374151`
- `break` blocks (meals, rest): Light Gray `#D1D5DB`
- `buffer` blocks (free time): Near-white `#F3F4F6`

Users can create custom types via a `project_types` table with their own name, slug, and color hex.

### Tasks

A Task is a unit of work — the *what*. It belongs to a project, has an estimated duration, and tracks its own completion state. Tasks do not own time directly; they are assigned to TimeBlocks on the schedule grid.

```
Task {
  id                  UUID
  project_id          UUID (FK → Project)
  template_task_id    UUID (nullable — FK → TemplateTask, if created from template)
  name                string
  description         text (optional)
  status              enum: pending | in_progress | complete | partial | skipped | overdue
  order               int (sort order within project)
  scheduled_start     datetime (nullable — earliest TimeBlock assigned to this task)
  scheduled_end       datetime (nullable — latest TimeBlock assigned to this task)
  actual_start        datetime (nullable — stamped when user confirms "started")
  actual_end          datetime (nullable — stamped when user confirms "done")
  started_on_time     boolean (computed: actual_start <= scheduled_start)
  completed_on_time   boolean (computed: actual_end <= scheduled_end)
  duration_estimate   int (minutes — estimated total time for this task)
  duration_actual     int (minutes — sum of all completed focus session time + manually logged time)
  is_milestone        boolean (marks key checkpoints)
  depends_on          UUID[] (nullable — task dependency references)
  notes               text
  created_at          datetime
  updated_at          datetime
}
```

**Computed properties (not stored, derived at query time):**
- `blocks_assigned`: count of TimeBlocks where task_id = this task
- `blocks_completed`: count of those TimeBlocks where status = done
- `session_label`: "Session {blocks_completed}/{blocks_assigned}" (e.g. "Session 5/8")

**Task status transitions:**

Tasks transition via explicit user prompts, not silently. The system sends a push notification at the relevant time and the user's response (or lack of response) determines the transition.

```
                          ┌─────────────────────────────────────┐
                          │          STATUS TRANSITIONS         │
                          └─────────────────────────────────────┘

  [pending] ──── scheduled_start arrives ────→ NOTIFICATION SENT:
                 "Did you start [Task Name]?"      │
                                                   ├── User taps YES → [in_progress]
                                                   │     (actual_start stamped)
                                                   ├── User taps NO / SKIP → [skipped]
                                                   └── No response (configurable timeout, default 30min) → [skipped]

  [in_progress] ── scheduled_end arrives ──→ NOTIFICATION SENT:
                   "Has [Task Name] been completed?"    │
                                                        ├── User taps COMPLETED → [complete]
                                                        │     (actual_end stamped)
                                                        ├── User taps PARTIAL → [partial]
                                                        │     (user can add more blocks later)
                                                        ├── User taps NOT DONE → remains [in_progress]
                                                        │     (task continues, may become overdue)
                                                        └── User taps SKIP → [skipped]

  [in_progress] ── deadline passes + no response ──→ [overdue]
                   (flagged in dashboard and analytics)

  [partial] ── user adds more blocks and resumes ──→ [in_progress]
  [partial] ── user decides work is sufficient ──→ [complete]

  [skipped] ── user manually restarts ──→ [pending] (can be rescheduled)

  [complete] ── user realizes more work needed ──→ [in_progress]
               (add more blocks, actual_end cleared)
```

**Key rule:** A task can be marked `complete` even if not all assigned TimeBlocks have been worked. Creative work is unpredictable — you might finish in 5 of 8 scheduled sessions. Conversely, if more time is needed, additional TimeBlocks can be assigned to the task at any point.

### Time Blocks (Schedule Grid Cells)

A TimeBlock is the *when* — a fixed 30-minute cell on a day's time grid. Think of it as a row in a spreadsheet where the Y-axis is time of day. A TimeBlock is either empty or has a task assigned to it. Multiple consecutive blocks assigned to the same task form a visual "session." Session numbering (e.g. "Session 5/8") is computed by counting completed and total blocks for that task across all days — it is not stored on the block itself.

```
TimeBlock {
  id                  UUID
  task_id             UUID (nullable — FK → Task; null = empty/available slot)
  project_id          UUID (nullable — FK → Project; derived from task, used for color-coding)
  schedule_day_id     UUID (FK → ScheduleDay)
  label               string (nullable — display override, e.g. "Lunch", "🏢 WORK", "Wind down")
  block_type          enum: task | fixed | break | buffer
  start_time          datetime
  end_time            datetime (always start_time + 30 minutes)
  status              enum: empty | assigned | done | skipped
  notes               string (nullable — per-block context, e.g. "picking up from 30% complete")
  created_at          datetime
}
```

**Block types:**
- `task` — assigned to a Task; colored by the task's project type
- `fixed` — immovable commitments (work hours, concerts, appointments); not assignable to tasks
- `break` — meals, rest, wind-down; displayed in neutral color
- `buffer` — intentionally unscheduled free time; available for task assignment if needed

**Block status:**
- `empty` — no task assigned, available for scheduling
- `assigned` — task assigned, not yet worked
- `done` — task block worked/completed
- `skipped` — explicitly skipped by user

**Validation rules:**
- Two different tasks may overlap on the same block (blocks from different projects), but the UI shows a warning indicator when overlaps exist
- Two blocks with the *exact same* task_id, start_time, and duration are not allowed (no true duplicates)
- Blocks are always 30-minute increments aligned to :00 and :30 boundaries

**How tasks fill blocks:**
When a task with `duration_estimate = 240 minutes` (4 hours) is scheduled, 8 consecutive TimeBlocks are created (or as many consecutive blocks as available, continuing to the next day if needed). Blocks can also be assigned individually for non-contiguous scheduling.

### Schedule Days

Groups time blocks into daily views, mirroring the per-day sheet structure from the reference spreadsheet.

```
ScheduleDay {
  id                  UUID
  date                date
  day_type            enum: workday | weekend | day_off | show_day
  title               string (e.g. "SATURDAY, FEBRUARY 28 — Weekend ⚡ BIG DAY")
  subtitle            string (nullable — e.g. "Full day | Whiplash finish + Reel #2 music + Haircut")
  available_start     time (earliest schedulable time, e.g. 8:30 AM or 5:00 PM)
  available_end       time (latest schedulable time, e.g. 1:00 AM or 11:00 PM)
  total_available     int (minutes — computed from available window minus fixed blocks like work/meals)
  total_scheduled     int (minutes — computed from task blocks)
  notes               text (nullable)
  created_at          datetime
}
```

### Schedule Entries (Recurrence Rules)

ScheduleEntries define *recurring* time commitments that auto-generate TimeBlocks on ScheduleDays. They are the template layer — not directly visible on the grid, but responsible for populating it. One-off blocks are created directly as TimeBlocks without a ScheduleEntry.

```
ScheduleEntry {
  id                  UUID
  task_id             UUID (nullable — FK → Task, if this recurrence is for a specific task)
  project_id          UUID (nullable — FK → Project)
  title               string (e.g. "Evening production session", "🏢 Work hours")
  block_type          enum: task | fixed | break | buffer
  recurrence_rule     string (iCal RRULE format, e.g. "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")
  start_time          time (time of day, e.g. 19:00)
  end_time            time (time of day, e.g. 22:30)
  reminder_offset     int (minutes before start to send notification, default 5)
  active              boolean
  created_at          datetime
}
```

**Example ScheduleEntries:**
- "Work hours" → RRULE weekdays 7:45 AM–4:30 PM → generates `fixed` blocks on every workday
- "Dinner" → RRULE daily 6:00 PM–7:00 PM → generates `break` blocks
- "Evening production session" → RRULE weekdays 7:00 PM–10:00 PM → generates `task` blocks (task assigned separately)

**Relationship to TimeBlocks:** When a ScheduleDay is created (or when recurrence rules are evaluated by the cron), the system generates TimeBlocks from active ScheduleEntries. Generated blocks can then be individually edited, moved, or deleted without affecting the underlying recurrence rule.

### Notifications Log

```
Notification {
  id                  UUID
  task_id             UUID (nullable — FK → Task)
  time_block_id       UUID (nullable — FK → TimeBlock)
  sent_at             datetime
  type                enum: task_start_prompt | task_end_prompt | overdue | milestone | summary
  message             string
  deep_link           string (URL path to open in-app, e.g. "/focus/task/{task_id}" or "/today")
  response            enum: pending | yes | no | partial | skip | dismissed | expired (nullable)
  responded_at        datetime (nullable)
}
```

**Notification content templates:**

| Type | Timing | Message Format | Tap Action |
|---|---|---|---|
| `task_start_prompt` | 5 min before block start | "Whiplash: Composition — Session 5/8 starts in 5 min. Ready to begin?" | Opens task focus session |
| `task_end_prompt` | At block end time | "Whiplash: Composition — Session 5/8 time is up. Has this task been completed?" | Opens task with status options |
| `overdue` | Configurable time after scheduled_end | "[Task Name] is past due. Mark as complete, partial, or reschedule?" | Opens task detail |
| `milestone` | When milestone task is marked complete | "Milestone reached: [Task Name] ✅ — [Project Name] is now X% complete" | Opens project detail |
| `summary` | Daily at configured time (default 8 AM) | "Today: 6 blocks scheduled across 2 projects. First up: [Task] at [Time]" | Opens Today view |

**Notification behavior:**
- All notifications are actionable — tapping opens the app to the relevant view via `deep_link`
- `task_start_prompt` shows YES / SKIP buttons inline (Ntfy.sh supports action buttons)
- `task_end_prompt` shows COMPLETED / PARTIAL / NOT DONE / SKIP buttons
- No response within 30 minutes of a `task_start_prompt` → task is auto-set to `skipped`
- Notification history is viewable in-app with full response log

### Archive Record

Archives store a comprehensive snapshot of the entire project state at archive time, including all related data. Storage space is not a concern — completeness is preferred over compactness.

```
ArchiveRecord {
  id                  UUID
  project_id          UUID (FK)
  archived_at         datetime
  reason              enum: complete | shelved | abandoned
  snapshot            JSON (complete frozen state — see below)
  notes               text (optional — why shelved/abandoned)
}
```

**Snapshot contents (JSON):** The `snapshot` field captures the full project graph at archive time:
- Project metadata (name, type, status, tags, deadline, etc.)
- All Tasks with their final statuses, duration estimates, actual durations, and notes
- All TimeBlocks assigned to the project's tasks (with dates, statuses, block notes)
- All SessionNotes linked to the project's tasks
- All FocusSessions linked to the project's tasks (with durations, pomodoro counts, pause logs)
- Computed analytics at archive time: total hours estimated, total hours spent, on-time rates, session completion rate

This enables full reconstruction if a project is reopened, and allows archive-level analytics or summarization via external tools.

### Project Templates

Reusable task structures that can seed new projects. A template captures the workflow pattern (task names, order, categories, estimated durations, session counts) without any dates or statuses.

```
ProjectTemplate {
  id                  UUID
  name                string (e.g. "Song Release Pipeline", "Open Mic Prep", "IG Reel from Scratch")
  description         text (optional)
  project_type        enum → same as Project Types
  default_tags        string[] (pre-applied tags when template is instantiated)
  total_estimated_hrs float (computed from template tasks)
  created_at          datetime
  updated_at          datetime
  created_from_id     UUID (nullable — FK → Project, if template was derived from a completed project)
}

TemplateTask {
  id                  UUID
  template_id         UUID (FK → ProjectTemplate)
  name                string (e.g. "Composition & mixing")
  description         text (optional)
  category            string (nullable — e.g. "Production", "Social", "Rehearsal")
  order               int (sequence within template)
  duration_estimate   int (minutes)
  session_count       int (nullable — how many time blocks this task typically needs)
  block_size          int (minutes — fixed at 30)
  is_milestone        boolean
  depends_on_order    int[] (nullable — references other TemplateTasks by order position)
  notes               text (nullable — default notes carried into new tasks)
}
```

**Template instantiation flow:**
1. User selects a template and provides: project name, target deadline, start date
2. System creates a new Project from the template metadata
3. System creates Tasks from each TemplateTask, copying name/category/duration/order/notes
4. All dates/statuses are blank — user can then manually schedule via the calendar
5. **Optional auto-schedule:** If the user enables auto-schedule at instantiation, the system distributes TimeBlocks across ScheduleDays using the following algorithm:

**Auto-schedule algorithm:**
```
INPUT:  tasks[] (ordered, with duration_estimate), date_range (start → deadline)
OUTPUT: TimeBlock assignments across ScheduleDays

1. Collect all ScheduleDays in the date range
2. For each day, compute available_blocks:
   - Generate 30-min block slots from available_start to available_end
   - Subtract blocks already marked as fixed/break (work hours, meals, etc.)
   - Result: ordered list of empty assignable slots per day
3. Process tasks in order (respecting depends_on dependencies):
   a. Calculate blocks_needed = ceil(task.duration_estimate / 30)
   b. Starting from the earliest day with available slots:
      - Assign consecutive empty blocks to this task
      - If the day runs out of blocks before the task is fully assigned,
        continue on the next day's available blocks
      - Prefer contiguous blocks within a day (avoid scattering a task
        across isolated single blocks when a contiguous run is available)
   c. Move to the next task
4. After all tasks are placed, run feasibility check:
   - total_blocks_needed vs total_blocks_available across the date range
   - If needed > available: warn user, show deficit in hours
   - If needed ≤ available: show buffer (available - needed) in hours
5. User can review the auto-generated schedule in the day planner and
   manually adjust any block assignments before confirming
```

**Notes on auto-schedule:**
- The algorithm is greedy (first-fit, earliest-available) — it does not optimize for even distribution across days. The user is expected to manually adjust if they prefer spreading work out.
- Fixed blocks (work, meals, events) are never overwritten.
- If a task has `depends_on` references, it will not be scheduled before its dependency tasks are fully placed.
- Auto-schedule is a convenience starting point, not a constraint. Every block can be moved or deleted after generation.

**Template creation flow:**
1. **From scratch:** User defines template name, type, and manually adds TemplateTask entries
2. **From existing project:** User clicks "Save as Template" on an active or archived project → task names, categories, durations, and order are extracted; all dates, statuses, and actual times are stripped

### Session Notes (Timestamped Journal)

Attach notes to active work sessions. Designed for capturing creative decisions, blockers, ideas, or context while working — timestamped so you can reconstruct what happened and when.

```
SessionNote {
  id                  UUID
  project_id          UUID (FK → Project)
  task_id             UUID (nullable — FK → Task, if tied to a specific task)
  focus_session_id    UUID (nullable — FK → FocusSession, if written during a focus session)
  content             text (the note body — supports markdown)
  note_type           enum: idea | decision | blocker | progress | general
  created_at          datetime (auto-stamped)
  updated_at          datetime
}
```

**Usage patterns:**
- Quick-capture during a focus session: tap a note icon, type, it auto-associates with the current task/session
- Review session notes on the project detail page in chronological order
- Filter notes by type (just ideas, just blockers, etc.)
- Session notes from a focus session are grouped and visible in the focus session summary

### Focus Sessions (Deep Work Timer)

A built-in focus timer that tracks active work time on a task. Supports both free-running and structured (Pomodoro-style) modes. Auto-logs duration to the associated task.

```
FocusSession {
  id                  UUID
  task_id             UUID (FK → Task)
  project_id          UUID (FK → Project)
  mode                enum: free | pomodoro
  started_at          datetime
  ended_at            datetime (nullable — null while session is active)
  target_duration     int (minutes — e.g. 25 for pomodoro, or custom like 90 for a deep session)
  actual_duration     int (minutes — computed from started_at to ended_at, excluding pauses)
  break_duration      int (minutes — total break time if pomodoro mode)
  pomodoro_count      int (number of pomodoro cycles completed in this session)
  pauses              JSON (array of {paused_at, resumed_at} timestamps)
  status              enum: active | paused | completed | abandoned
  sync_status         enum: synced | pending_sync | conflict
  notes_count         int (computed — number of SessionNotes linked to this session)
  created_at          datetime
}
```

**Offline behavior:** The focus timer runs client-side. If connectivity is lost, the session continues locally and `sync_status` is set to `pending_sync`. When connectivity resumes, the full session record (start, end, pauses, duration) is pushed to the server. If the server already has a different version of the same session (e.g. resumed from another device), `sync_status` is set to `conflict` for manual review.

**Focus session modes:**

1. **Free mode:** Start a timer, work until done. Timer counts up. Pause/resume as needed. When you stop, actual_duration is logged to the task.
2. **Pomodoro mode:** Configurable work/break intervals (default 25min work / 5min break / 15min long break every 4 cycles). Notifications fire at each transition. Completed pomodoros are counted.

**Integration with tasks and time blocks:**
- Starting a focus session on a task auto-sets `task.actual_start` if not already set
- Completing a focus session adds its `actual_duration` to `task.duration_actual`
- If the task has TimeBlocks for today, the focus session can auto-mark those blocks as `done`, advancing the computed session label
- Focus session summary shows: time worked, notes taken, task progress before/after

### Google Calendar Sync

Bidirectional sync between Katsu schedule entries and Google Calendar, enabling visibility of creative schedules alongside other life events.

```
CalendarSync {
  id                  UUID
  google_calendar_id  string (the target Google Calendar ID — can be primary or a dedicated "Katsu" calendar)
  sync_direction      enum: push_only | pull_only | bidirectional
  last_synced_at      datetime (nullable)
  sync_enabled        boolean
  created_at          datetime
  updated_at          datetime
}

CalendarEventMapping {
  id                  UUID
  calendar_sync_id    UUID (FK → CalendarSync)
  schedule_entry_id   UUID (nullable — FK → ScheduleEntry)
  time_block_id       UUID (nullable — FK → TimeBlock)
  google_event_id     string (Google Calendar event ID)
  sync_status         enum: synced | pending | conflict | error
  last_synced_at      datetime
}
```

**Sync behavior:**

1. **Push (Katsu → Google Calendar):**
   - When a ScheduleDay is finalized or TimeBlocks are created/modified, corresponding Google Calendar events are created/updated
   - Events include the task name, project name, session number, project type color, and notes
   - Color mapping: Katsu categories → Google Calendar event colors (e.g. Production = blue, Rehearsal = green)
   - Deleted blocks remove the corresponding Google Calendar event

2. **Pull (Google Calendar → Katsu):**
   - External events (concerts, appointments, work hours) can be pulled in as fixed/unavailable blocks in ScheduleDays
   - Auto-marks time windows as unavailable when scheduling tasks
   - Changes to external events update the corresponding blocks in Katsu

3. **Bidirectional:**
   - Combines push + pull
   - Conflict resolution: last-write-wins with a conflict log for review
   - User can designate which calendar(s) to sync with (e.g., a dedicated "Katsu" calendar for push, primary calendar for pull)

**Implementation approach:**
- Use Google Calendar API v3 via OAuth 2.0 (service account or user consent flow)
- Store refresh tokens securely in `.env`
- Sync runs on a configurable interval (default every 15 minutes) via the existing cron scheduler
- Manual sync trigger available in UI
- iCal feed export as a fallback for calendar apps that don't support Google API

---

## Core Features

### 1. Project CRUD & Catalog

- Create, read, update, delete projects
- Assign project type, status, priority, tags, deadline
- Dashboard view: cards grouped by project type, filterable by status
- Project detail view: task list, schedule, progress bar, timeline
- Quick-status indicators: 🟢 on track | 🟡 at risk | 🔴 behind schedule

### 2. Task Management

- Add/edit/delete/reorder tasks within a project
- Mark tasks as started (stamps `actual_start`) and complete (stamps `actual_end`)
- Auto-compute `started_on_time` and `completed_on_time` booleans
- Visual indicators for late starts and missed deadlines
- Task dependency awareness: warn if a prerequisite task isn't complete
- Bulk task operations (mark multiple complete, reschedule batch)

### 3. Scheduling & Time Blocks

The schedule is a grid with time on the Y-axis and days on the X-axis. Each cell is a 30-minute TimeBlock. Tasks fill these cells according to their estimated duration. The grid is the primary workspace of the app.

- **Day planner view (desktop):** Full daily grid from `available_start` to `available_end`, each row is a 30-minute block. Task blocks are colored by project type and display the task name + session label (e.g. "Session 5/8"). Empty blocks are visually distinct and available for assignment.
- **Block assignment:** Select a task from the sidebar/panel, then click empty blocks to assign. Or select a duration ("4 hours") and the system assigns 8 consecutive blocks starting from a chosen slot.
- **Session numbering:** Computed dynamically — count completed blocks for a task across all days vs total assigned blocks. Displayed on each block as "Session N/M".
- **30-minute block granularity:** All blocks are fixed at 30 minutes, aligned to :00 and :30 boundaries. This simplifies the grid and keeps mobile usable.
- **Multi-project coexistence:** Blocks from different projects can be scheduled on the same day. If blocks from different projects overlap the same time slot, a warning indicator is shown but the overlap is allowed. Blocks with the exact same task, start time, and duration are rejected (no true duplicates).
- **Day types:** Workday (limited evening windows, e.g. 5:00 PM–11:00 PM), Weekend (full day, e.g. 8:30 AM–1:00 AM), Day Off (full day with possible fixed events), Show Day (performance-focused).
- **Fixed blocks:** Work hours, meals, concerts, and other non-task commitments are placed as `fixed` or `break` type blocks. They occupy grid space but cannot have tasks assigned to them.
- **Recurrence:** ScheduleEntries define recurring blocks (e.g. "Work: weekdays 7:45 AM–4:30 PM") that auto-generate TimeBlocks when a new ScheduleDay is created.
- **Available time computation:** Total available = (available_end - available_start) minus fixed/break blocks. Shown at the day level for feasibility awareness.
- **Feasibility summary:** When viewing a project's schedule, display total estimated hours vs total assigned block hours vs total available hours across the date range, with a buffer calculation and feasibility verdict.
- **Drag-and-drop (desktop only):** Move blocks between time slots or between days. Mobile uses tap-to-assign.
- **Calendar week view:** Shows block density and project color distribution across a week at a glance, clickable to drill into the day view.

### 4. Notifications & Status Prompts

Notifications are the primary accountability mechanism. They don't just remind — they prompt for action and drive task status transitions.

- **Web Push notifications** via the Push API (works on mobile browsers when PWA is installed)
- **Ntfy.sh integration** as a lightweight alternative — sends to the Ntfy mobile app without requiring PWA installation; supports inline action buttons (YES / SKIP / COMPLETE / PARTIAL)
- **Reminder (5 min before block start):** Sends task name, project name, session label, and a "Ready to begin?" prompt with YES / SKIP actions. Tapping YES marks the task as `in_progress` and opens the focus session. Tapping SKIP marks the task as `skipped`. No response after 30 minutes → auto-skip.
- **End-of-block prompt:** When a task's scheduled blocks end, sends "Has [Task] been completed?" with COMPLETED / PARTIAL / NOT DONE / SKIP actions. Response updates task status accordingly.
- **Overdue alert:** If a task remains `in_progress` past its scheduled end with no response, a follow-up notification is sent after a configurable delay.
- **Milestone notification:** When a milestone task is marked complete, sends a celebratory notification with project progress percentage.
- **Daily summary (default 8 AM):** "Today: 6 blocks scheduled across 2 projects. First up: [Task] at [Time]." Tapping opens the Today view.
- **Notification log:** All sent notifications and their responses are viewable in-app. Useful for reviewing accountability patterns in analytics.
- **Deep linking:** Every notification includes a `deep_link` URL path. Tapping opens the app directly to the relevant view (focus session, task detail, Today view, project detail).

### 5. Progress & Pace Tracking

The "ahead or behind" indicator is based on **time expected to invest vs time actually spent** — not task count or linear interpolation from a deadline.

- **Time invested vs time estimated:** For each project, compare `sum(task.duration_actual)` across all tasks against `sum(task.duration_estimate)`. If you've spent 12 of an estimated 20 hours, you're 60% through on time investment.
- **Scheduled time vs actual time:** Compare how many block-hours were scheduled by now vs how many block-hours have been marked done. If 10 hours of blocks were scheduled through today and you've completed 7 hours, you're behind by 3 hours.
- **Pace indicator:** Displays one of three states — Ahead (actual > scheduled-to-date), On Track (actual ≈ scheduled-to-date, within a configurable tolerance), Behind (actual < scheduled-to-date).
- **Burndown visualization:** Chart showing two lines over time — "scheduled cumulative hours" (the plan) vs "actual cumulative hours" (reality). Gap between them is the ahead/behind delta.
- **Per-task punctuality:** Percentage of tasks started on time (`started_on_time = true`) and completed on time (`completed_on_time = true`).
- **Completion percentage:** `tasks_complete / total_tasks` per project — a simple ratio shown on project cards and detail pages.
- **Session completion rate:** Across all projects, what percentage of assigned TimeBlocks were marked done vs skipped? Surfaced in analytics.

### 6. Analytics Dashboard

- **Overall stats**: total active projects, tasks completed this week/month, on-time rate
- **Trends over time**: line charts of tasks completed per week, on-time percentage over time
- **Project type breakdown**: bar chart of active projects by type, completion rates by type
- **Schedule adherence**: heatmap of which days/times you actually start tasks on time
- **Time estimation accuracy**: scatter plot of estimated vs actual duration per task
- **Streak tracking**: consecutive days with at least one task completed

### 7. Archive System

- Archive a project with a reason (complete, shelved, abandoned)
- Snapshot the full project + task state as JSON at archive time
- Archived projects viewable in a separate "Archive" section
- **Reopen**: restore an archived project to active status (unfreezes tasks, clears archive record)
- **Clone**: create a new project seeded from an archived project's structure — copies task templates but resets all timestamps and statuses

### 8. Mobile Experience

- Responsive web design (mobile-first)
- PWA manifest + service worker for home screen installation
- **Simplified list view on mobile:** Instead of the full time-block grid, mobile shows a scrollable list of blocks for the day — each row displays the time slot, task name (truncated if needed), and project color indicator. Tapping a block opens task actions (start, complete, add note, launch focus session).
- **No drag-and-drop on mobile:** Block rearrangement and scheduling is desktop-only. Mobile is for execution (starting tasks, marking done, adding notes) not planning.
- Tap-to-assign: On mobile, assign a task to a block by selecting the task first, then tapping the target time slot.
- Bottom navigation bar: Today | Projects | Calendar | Analytics
- Offline capability: View current state offline, queue actions (status changes, notes, focus session logs) and sync when connectivity is reestablished.

### 9. Today View (Daily Planning)

The default landing screen. Shows everything scheduled for today in a single, scannable view optimized for "what do I need to do right now?"

- **Timeline layout:** Vertical list of today's TimeBlocks in chronological order, grouped into past (dimmed), current (highlighted), and upcoming sections.
- **Current block emphasis:** The active or next-upcoming block is visually prominent — shows task name, project, session label ("Session 5/8"), countdown to start or time remaining, and a one-tap "Start Focus Session" button.
- **Quick actions per block:** Start / Complete / Skip / Add Note — all reachable in one tap without navigating away.
- **Day summary header:** Total blocks scheduled, blocks completed, hours remaining, across how many projects. Pace indicator (ahead / on track / behind) for the day.
- **Cross-project visibility:** Blocks from all active projects appear together, colored by project type, giving a unified daily view.
- **Overlap warnings:** If any blocks overlap, the Today view surfaces this at the top with a tap-to-resolve link.
- **Notification integration:** The daily summary notification ("Today: 6 blocks across 2 projects. First up: [Task] at [Time]") deep-links to this view.

### 10. Project Templates

Create, edit, and reuse template workflows so repeating project types don't need to be built from scratch every time.

- **Template library:** Browse and manage saved templates, organized by project type
- **Create from scratch:** Define template name, project type, and manually add TemplateTask entries with name, category, estimated duration, session count, order, and dependencies
- **Create from existing project:** "Save as Template" button on any active or archived project — extracts task structure, strips all dates/statuses/actual times
- **Edit templates:** Full CRUD on TemplateTask entries within a template — reorder, rename, adjust durations, toggle milestones
- **Instantiate a template:** Select template → provide project name, start date, deadline → system generates a new Project with pre-populated Tasks
- **Auto-schedule option:** When instantiating, optionally auto-distribute TimeBlocks across ScheduleDays based on available windows and task durations
- **Template versioning:** When a template is updated, previously instantiated projects are unaffected (they received a copy at creation time)
- **Starter templates (pre-built):**
  - "Song Release Pipeline" — write → record → mix → master → release
  - "IG Reel from Scratch" — music production (7hrs) → video filming → video editing → finalize & publish
  - "Open Mic Prep" — production → gear setup → rehearsals → social media → show day
  - "Web Project" — design → develop → test → deploy

### 11. Session Notes (Timestamped Journal)

Capture creative decisions, blockers, ideas, and context while working — timestamped and linked to the task or focus session in progress.

- **Quick-capture:** Tap a note icon on any active task or focus session; auto-associates with current context
- **Note types:** Categorize as `idea`, `decision`, `blocker`, `progress`, or `general` — filterable in review
- **Markdown support:** Notes support basic markdown for formatting code snippets, links, lists
- **Chronological timeline:** Project detail page shows all session notes in time order, grouped by day
- **Focus session grouping:** Notes written during a focus session are bundled in the session summary
- **Search:** Full-text search across all session notes, filterable by project, task, type, and date range
- **Export:** Include session notes in project CSV/JSON exports for external review
- **Mobile-optimized input:** Large tap target, auto-timestamp, minimal friction — designed for mid-session capture without breaking flow

### 12. Focus Sessions (Deep Work Timer)

A built-in timer for tracking active work on a task. Supports free-running and Pomodoro-style modes. Auto-logs time to the associated task and integrates with session notes and time blocks.

- **Free mode:** Start a count-up timer, work until done. Pause/resume as needed. Total active time (excluding pauses) is logged to the task when the session ends.
- **Pomodoro mode:** Configurable work/break intervals (default: 25min work / 5min break / 15min long break every 4 cycles). Push notification at each transition. Pomodoro count tracked.
- **Start from task or time block:** Tap "Focus" on any task or active time block to begin a session. Task's `actual_start` is auto-stamped if not already set.
- **Auto-advance sessions:** When a focus session completes, the associated TimeBlock(s) are marked `done` and the task's computed `blocks_completed` count updates, advancing the session label.
- **Pause tracking:** Pauses are recorded with timestamps so you can see focus vs break ratio.
- **Session summary:** On completion, shows: total time worked, pomodoros completed (if applicable), notes taken, session progress change (e.g. "Session 5/8 → 8/8").
- **Notifications:** Pomodoro transitions, session end reminders ("you've been working for 90 minutes — take a break?"), and idle detection ("session paused for 15+ minutes — still working?")
- **Offline resilience:** Focus timer runs client-side with local state. If connectivity is lost during a session, the timer continues locally. When connectivity is reestablished, the session data (start time, end time, pauses, duration) is synced to the server. No data is lost.
- **Server-side checkpointing (when online):** Timer state is periodically saved to the server so it can be resumed from a different device if needed.
- **Analytics integration:** Focus session data feeds into the analytics dashboard: total deep work hours per week, average session length, most productive time of day, pomodoro completion rate.

### 13. Google Calendar Sync

Bidirectional sync between Katsu schedules and Google Calendar, so creative schedules are visible alongside other life events and external commitments auto-block time in Katsu.

- **Push (Katsu → Google Calendar):**
  - ScheduleDays and TimeBlocks are synced as Google Calendar events
  - Events include task name, project name, session number (e.g. "Whiplash: Composition — 5/8"), and notes
  - Project type colors map to Google Calendar event colors (e.g. music = yellow, web dev = blue)
  - Creates events in a dedicated "Katsu" calendar (auto-created on first sync) to avoid cluttering the primary calendar
  - Block deletions/modifications propagate to Google Calendar

- **Pull (Google Calendar → Katsu):**
  - External events (concerts, appointments, work hours) are imported as fixed/unavailable blocks in ScheduleDays
  - Auto-marks time windows as unavailable when scheduling tasks
  - Configurable which Google Calendar(s) to pull from (e.g., primary calendar, shared calendars)
  - Changes to external events update the corresponding blocks in Katsu

- **Sync settings:**
  - Direction: push-only, pull-only, or bidirectional
  - Sync interval: configurable (default every 15 minutes via cron)
  - Manual sync trigger in UI
  - Conflict resolution: last-write-wins with a conflict log for review

- **iCal feed fallback:** Export Katsu schedules as an `.ics` feed URL for calendar apps that don't use Google Calendar API

- **Implementation:** Google Calendar API v3 via OAuth 2.0, refresh tokens in `.env`, sync via existing cron scheduler

---

## Future Features

### CSV/Spreadsheet Import (Priority: Next)

- Import `.csv` or `.xlsx` files to bulk-create or update tasks and schedule entries
- Define a standard template format:
  ```
  task_name, project_name, scheduled_start, scheduled_end, duration_estimate, notes
  ```
- Validation + preview UI before committing import
- Export to CSV for external analysis or backup

### Additional Future Features to Consider

- **Goal Setting Layer** — Set weekly/monthly goals like "complete 3 tasks" or "work on music 5 days this week." Track against goals in analytics.

- **Webhook/API Endpoints** — Expose a simple REST API so external tools (scripts, automations, other apps) can create tasks or log completions. Enables integration with other parts of your workflow.

- **Version History / Changelog** — Track changes to project and task data over time. See when deadlines were moved, tasks added/removed, status changes — useful for retrospective analysis.

- **Multi-Device Sync Conflict Resolution** — When moving to local hosting, handle cases where edits are made offline on mobile and desktop simultaneously.

- **AI-Assisted Schedule Suggestions** — Use historical completion data to suggest realistic time estimates for new tasks and flag schedules that are overly ambitious based on your patterns.

- **Supplementary Trackers** — Modeled after the reference spreadsheet's Social Media Tracker and Gear Checklist sheets: custom checklist views that live alongside a project's schedule. Could support reusable checklist templates (e.g., "Performance Day Gear Checklist").

---

## Cloud → Local Migration Plan

The app is designed from day one to run identically in both environments:

```
┌─────────────────────────────────────────┐
│           Docker Container              │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │  React   │  │  Node.js │  │ SQLite │ │
│  │  (nginx) │  │  API     │  │  .db   │ │
│  └─────────┘  └──────────┘  └────────┘ │
│         ↕            ↕                  │
│     port 80      port 3000              │
└─────────────────────────────────────────┘
         │
    docker-compose.yml
```

### Migration Steps

1. `docker-compose down` on cloud host
2. Copy `docker-compose.yml` + `katsu.db` + `.env` to ThinkCentre
3. `docker-compose up -d` on ThinkCentre
4. Set up Caddy/nginx reverse proxy for LAN access or Tailscale for remote access
5. Update Ntfy.sh topic or Web Push VAPID keys if domain changes
6. Done — identical app, local hardware

---

## Development Phases

### Phase 1: Foundation (MVP)

- [ ] Project setup: React + TypeScript frontend, Node/Express backend, SQLite
- [ ] Docker + docker-compose configuration
- [ ] Database schema + Drizzle ORM migrations
- [ ] Project CRUD (create, list, detail, edit, delete)
- [ ] Task CRUD within projects (add, edit, reorder, status toggling)
- [ ] Basic dashboard: project cards grouped by type, status filters
- [ ] Project detail page: task list with progress bar
- [ ] Mobile-responsive layout with bottom nav

### Phase 2: Time Blocks, Scheduling & Today View

- [ ] ScheduleDay and TimeBlock CRUD
- [ ] Day planner view (desktop): full daily grid with 30-min blocks, color-coded by project type
- [ ] Session numbering display ("Session 5/8") — computed from block counts, not stored
- [ ] Project type → color mapping system with legend
- [ ] Day type support (workday, weekend, day_off, show_day) with available-time computation
- [ ] Block types: task, fixed, break, buffer
- [ ] Block assignment: select task, click/tap blocks to assign; multi-block assignment by duration
- [ ] Block validation: overlap warning for cross-project conflicts; reject exact duplicates
- [ ] Week calendar view showing block density and project color distribution
- [ ] Block manipulation (desktop): drag-and-drop between slots and days
- [ ] Feasibility summary: total task hours vs available hours with buffer/verdict
- [ ] **Today view:** Default landing screen with timeline of today's blocks, current block emphasis, quick actions (start/complete/skip/note), day summary header, cross-project visibility
- [ ] ScheduleEntry CRUD for recurrence rules that auto-generate blocks

### Phase 3: Notifications, Status Prompts & Focus Sessions

- [ ] ScheduleEntry recurrence → TimeBlock generation via cron
- [ ] node-cron scheduler for checking upcoming blocks and task transitions
- [ ] Ntfy.sh notification integration with inline action buttons (YES/SKIP/COMPLETE/PARTIAL)
- [ ] Web Push API integration (PWA)
- [ ] **Task start prompt:** 5 min before block start → "Ready to begin?" → YES sets in_progress, SKIP sets skipped, no response after 30min → auto-skip
- [ ] **Task end prompt:** At block end → "Has this been completed?" → COMPLETED / PARTIAL / NOT DONE / SKIP
- [ ] Deep linking: notification tap opens the relevant in-app view (focus session, task detail, Today view)
- [ ] Notification log + response history UI
- [ ] Countdown timer display for active/upcoming blocks
- [ ] Focus session implementation: free mode + pomodoro mode
- [ ] Focus session UI: timer display, pause/resume, session summary
- [ ] Auto-advance block status to `done` when focus session ends
- [ ] Focus session notifications (pomodoro transitions, idle detection)
- [ ] Offline focus timer: client-side state with sync-on-reconnect

### Phase 4: Session Notes & Tracking

- [ ] SessionNote CRUD with auto-timestamp and context linking (task, focus session)
- [ ] Note type categorization (idea, decision, blocker, progress, general)
- [ ] Quick-capture UI: minimal-friction note input during active sessions
- [ ] Chronological note timeline on project detail page
- [ ] On-time tracking logic (started_on_time, completed_on_time computation)
- [ ] Expected vs actual progress calculation (pace indicator)
- [ ] Analytics dashboard with charts (Recharts or Chart.js)
- [ ] Schedule adherence heatmap
- [ ] Time estimation accuracy tracking
- [ ] Focus session analytics (deep work hours, session lengths, productive times)
- [ ] Daily/weekly summary notifications

### Phase 5: Templates

- [ ] ProjectTemplate and TemplateTask CRUD
- [ ] Template library view: browse, search, filter by project type
- [ ] Create template from scratch (manual TemplateTask entry)
- [ ] "Save as Template" flow from active/archived projects
- [ ] Template instantiation: select template → configure → generate project with tasks
- [ ] Optional auto-schedule: distribute TimeBlocks across ScheduleDays on instantiation
- [ ] Pre-built starter templates (Song Release, IG Reel, Open Mic Prep, Web Project)

### Phase 6: Archive, Clone & Google Calendar

- [ ] Archive flow with reason selection and snapshot
- [ ] Archive browser view
- [ ] Reopen project from archive
- [ ] Clone project from archive (or from active projects)
- [ ] Archive search and filtering
- [ ] Google Calendar OAuth 2.0 setup
- [ ] Push sync: Katsu TimeBlocks/ScheduleEntries → Google Calendar events
- [ ] Pull sync: Google Calendar events → fixed blocks in ScheduleDays
- [ ] Sync settings UI (direction, interval, calendar selection)
- [ ] Conflict log and manual sync trigger
- [ ] iCal feed export fallback

### Phase 7: Import/Export & Polish

- [ ] CSV/JSON export (projects, tasks, session notes, focus sessions)
- [ ] CSV import: format specification to be defined after core app is stable — the data model needs to be validated through real use before committing to an import schema
- [ ] CSV import UI with validation + preview when format is defined
- [ ] PWA service worker for offline support (view state, queue actions, sync on reconnect)
- [ ] Full-text search across session notes
- [ ] Performance optimization and UX polish

---

## File Structure

```
katsu/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── README.md
│
├── client/                    # React frontend
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── sw.js              # Service worker
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # Nav, sidebar, bottom bar
│   │   │   ├── projects/      # Project cards, forms, detail
│   │   │   ├── tasks/         # Task list, status toggles
│   │   │   ├── time-blocks/   # Day planner grid, block manipulation, session labels
│   │   │   ├── calendar/      # Week/day calendar views
│   │   │   ├── focus/         # Focus timer display, pomodoro UI, session summary
│   │   │   ├── notes/         # Quick-capture input, note timeline, note filters
│   │   │   ├── templates/     # Template library, template editor, instantiation wizard
│   │   │   ├── analytics/     # Charts and dashboards
│   │   │   └── archive/       # Archive browser
│   │   ├── hooks/
│   │   │   ├── useFocusTimer.ts     # Focus session state management + persistence
│   │   │   ├── useTimeBlocks.ts     # Block grid manipulation logic
│   │   │   └── useCalendarSync.ts   # Google Calendar sync status
│   │   ├── api/               # API client functions
│   │   ├── types/             # TypeScript interfaces
│   │   ├── utils/             # Helpers, date math, progress calc, color mapping
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── tasks.ts
│   │   │   ├── time-blocks.ts
│   │   │   ├── schedules.ts
│   │   │   ├── focus-sessions.ts
│   │   │   ├── session-notes.ts
│   │   │   ├── templates.ts
│   │   │   ├── notifications.ts
│   │   │   ├── calendar-sync.ts
│   │   │   └── archive.ts
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle ORM schema (all entities)
│   │   │   ├── migrations/
│   │   │   └── index.ts       # DB connection
│   │   ├── services/
│   │   │   ├── scheduler.ts   # Cron job logic (notifications, sync, overdue checks)
│   │   │   ├── notifier.ts    # Push + Ntfy dispatch
│   │   │   ├── analytics.ts   # Aggregation queries
│   │   │   ├── archive.ts     # Snapshot + restore logic
│   │   │   ├── template-engine.ts   # Template instantiation + auto-schedule
│   │   │   ├── focus-timer.ts       # Server-side timer state persistence
│   │   │   └── google-calendar.ts   # Google Calendar API integration
│   │   ├── middleware/
│   │   │   └── auth.ts        # Simple token auth
│   │   ├── utils/
│   │   │   ├── time-blocks.ts # Block generation, feasibility calc, session numbering
│   │   │   └── project-colors.ts  # Project type → color hex mapping
│   │   └── index.ts           # App entry point
│   ├── tsconfig.json
│   └── package.json
│
└── data/
    └── katsu.db               # SQLite database file (git-ignored, volume-mounted)
```

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production
AUTH_TOKEN=your-secret-token-here

# Database
DB_PATH=./data/katsu.db

# Notifications - Ntfy
NTFY_TOPIC=katsu-notifications
NTFY_SERVER=https://ntfy.sh

# Notifications - Web Push (VAPID)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=your-email@example.com

# Google Calendar Sync
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_CALENDAR_ID=primary          # or a dedicated calendar ID
GCAL_SYNC_INTERVAL_CRON=*/15 * * * *  # every 15 minutes

# Focus Timer Defaults
POMODORO_WORK_MINUTES=25
POMODORO_BREAK_MINUTES=5
POMODORO_LONG_BREAK_MINUTES=15
POMODORO_CYCLES_BEFORE_LONG=4

# Optional
DAILY_SUMMARY_CRON=0 8 * * *    # 8am daily summary
BLOCK_SIZE=30                    # minutes — fixed at 30
TASK_START_PROMPT_OFFSET=5       # minutes before block start to send prompt
AUTO_SKIP_TIMEOUT=30             # minutes without response before auto-skip
```

---

## Development Notes

- **Why SQLite over Postgres?** For a single-user app, SQLite eliminates an entire service dependency. The database is a single file, making backup and migration trivial. If multi-user support is ever needed, Drizzle ORM supports Postgres with minimal schema changes.

- **Why Ntfy.sh?** It's the fastest path to reliable mobile push notifications without dealing with Apple/Google push infrastructure. Install the Ntfy app on your phone, subscribe to a topic, done. Web Push is the long-term replacement but requires PWA installation.

- **Why not a native mobile app?** A responsive PWA gives 90% of the native experience without maintaining a separate codebase. If native feel becomes critical later, the API-first design means a React Native or Flutter frontend can be added without touching the backend.

- **Timezone handling:** All datetimes stored in UTC. Frontend converts to local timezone for display. The schedule checker cron runs against UTC and computes offsets.

---

## Reference: Scheduling Format

The time block system is modeled after a reference spreadsheet (`open_mic_schedule.xlsx`) used for open mic prep scheduling. Key patterns extracted and adapted for Katsu:

- **Per-day sheets** with title (e.g. "SATURDAY, FEBRUARY 28 — Weekend ⚡ BIG DAY"), subtitle (focus areas), and a grid of 30-minute blocks from start to end of day
- **Color-coded blocks:** In the spreadsheet, blocks were color-coded by activity category (Production, Rehearsal, Social, Gear, etc.). In Katsu, blocks are colored by **project type** instead — all tasks belonging to a music project are yellow, web dev tasks are blue, etc. Non-task blocks (fixed, break, buffer) use neutral grays.
- **Session numbering:** Multi-block tasks display "Session 5/8" labels, computed by counting completed vs total assigned blocks for a task across all days
- **Overview sheet** with: feasibility analysis (total tasks vs available hours), time budget per day, task inventory (all tasks with category, hours, priority, target date, ✓ checkbox)
- **Notes per block** for context (e.g. "AIM TO FINISH MUSIC ✅", "picking up from 30% complete")
- **Day types:** Workday (limited evening window, e.g. 7–11PM), Weekend (full day 8:30AM–1AM), Day Off (full day with events), Show Day (performance-oriented)
- **Supplementary tracker sheets:** Social Media Tracker and Gear Checklist — these may be implemented as a future "Supplementary Trackers" feature

The Katsu scheduling UI replicates this level of granularity while making it interactive — blocks are tappable to start, complete, add notes, or launch focus sessions. Desktop provides the full grid with drag-and-drop; mobile provides a simplified chronological list view.
