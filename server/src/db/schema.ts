import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Project Types ─────────────────────────────────────────────
export const projectTypes = sqliteTable('project_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  color: text('color').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Projects ──────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  projectType: text('project_type').notNull(),
  color: text('color'),
  status: text('status', { enum: ['active', 'paused', 'complete', 'shelved', 'abandoned'] }).notNull().default('active'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull().default('medium'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  archivedAt: text('archived_at'),
  targetDeadline: text('target_deadline'),
  tags: text('tags').default('[]'),
  notes: text('notes'),
  parentProjectId: text('parent_project_id'),
  clonedFromId: text('cloned_from_id'),
});

// ─── Tasks ─────────────────────────────────────────────────────
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  templateTaskId: text('template_task_id'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'in_progress', 'complete', 'partial', 'skipped'] }).notNull().default('pending'),
  order: integer('order').notNull().default(0),
  scheduledStart: text('scheduled_start'),
  scheduledEnd: text('scheduled_end'),
  actualStart: text('actual_start'),
  actualEnd: text('actual_end'),
  startedOnTime: integer('started_on_time', { mode: 'boolean' }),
  completedOnTime: integer('completed_on_time', { mode: 'boolean' }),
  durationEstimate: integer('duration_estimate'),
  durationActual: integer('duration_actual').default(0),
  isMilestone: integer('is_milestone', { mode: 'boolean' }).default(false),
  dependsOn: text('depends_on').default('[]'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ─── Schedule Days ─────────────────────────────────────────────
export const scheduleDays = sqliteTable('schedule_days', {
  id: text('id').primaryKey(),
  date: text('date').notNull().unique(),
  dayType: text('day_type', { enum: ['workday', 'weekend', 'day_off', 'show_day'] }).notNull().default('workday'),
  title: text('title'),
  subtitle: text('subtitle'),
  availableStart: text('available_start').notNull().default('08:00'),
  availableEnd: text('available_end').notNull().default('23:00'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Time Blocks ───────────────────────────────────────────────
export const timeBlocks = sqliteTable('time_blocks', {
  id: text('id').primaryKey(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  scheduleDayId: text('schedule_day_id').notNull().references(() => scheduleDays.id, { onDelete: 'cascade' }),
  label: text('label'),
  blockType: text('block_type', { enum: ['task', 'fixed', 'break', 'buffer'] }).notNull().default('task'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status', { enum: ['empty', 'assigned', 'done', 'skipped'] }).notNull().default('empty'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Schedule Entries (Recurrence Rules) ───────────────────────
export const scheduleEntries = sqliteTable('schedule_entries', {
  id: text('id').primaryKey(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  blockType: text('block_type', { enum: ['task', 'fixed', 'break', 'buffer'] }).notNull(),
  recurrenceRule: text('recurrence_rule').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  reminderOffset: integer('reminder_offset').default(5),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Notifications ─────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  timeBlockId: text('time_block_id').references(() => timeBlocks.id, { onDelete: 'set null' }),
  sentAt: text('sent_at').default(sql`(datetime('now'))`),
  type: text('type', { enum: ['task_start_prompt', 'task_end_prompt', 'overdue', 'milestone', 'summary'] }).notNull(),
  message: text('message').notNull(),
  deepLink: text('deep_link'),
  response: text('response', { enum: ['pending', 'yes', 'no', 'partial', 'skip', 'dismissed', 'expired'] }),
  respondedAt: text('responded_at'),
});

// ─── Focus Sessions ────────────────────────────────────────────
export const focusSessions = sqliteTable('focus_sessions', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  mode: text('mode', { enum: ['free', 'pomodoro'] }).notNull().default('free'),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  endedAt: text('ended_at'),
  targetDuration: integer('target_duration'),
  actualDuration: integer('actual_duration'),
  breakDuration: integer('break_duration').default(0),
  pomodoroCount: integer('pomodoro_count').default(0),
  pauses: text('pauses').default('[]'),
  status: text('status', { enum: ['active', 'paused', 'completed', 'abandoned'] }).notNull().default('active'),
  syncStatus: text('sync_status', { enum: ['synced', 'pending_sync', 'conflict'] }).notNull().default('synced'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Session Notes ─────────────────────────────────────────────
export const sessionNotes = sqliteTable('session_notes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  focusSessionId: text('focus_session_id').references(() => focusSessions.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  noteType: text('note_type', { enum: ['idea', 'decision', 'blocker', 'progress', 'general'] }).notNull().default('general'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ─── Archive Records ───────────────────────────────────────────
export const archiveRecords = sqliteTable('archive_records', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  archivedAt: text('archived_at').default(sql`(datetime('now'))`),
  reason: text('reason', { enum: ['complete', 'shelved', 'abandoned'] }).notNull(),
  snapshot: text('snapshot').notNull(),
  notes: text('notes'),
});

// ─── Project Templates ─────────────────────────────────────────
export const projectTemplates = sqliteTable('project_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  projectType: text('project_type').notNull(),
  defaultTags: text('default_tags').default('[]'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  createdFromId: text('created_from_id'),
});

export const templateTasks = sqliteTable('template_tasks', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => projectTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  order: integer('order').notNull().default(0),
  durationEstimate: integer('duration_estimate'),
  sessionCount: integer('session_count'),
  blockSize: integer('block_size').default(30),
  isMilestone: integer('is_milestone', { mode: 'boolean' }).default(false),
  dependsOnOrder: text('depends_on_order').default('[]'),
  notes: text('notes'),
});

// ─── Work Intervals ───────────────────────────────────────────
export const workIntervals = sqliteTable('work_intervals', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  focusSessionId: text('focus_session_id').references(() => focusSessions.id, { onDelete: 'set null' }),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── App Settings ─────────────────────────────────────────────
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ─── Schedule Templates ───────────────────────────────────────
export const scheduleTemplates = sqliteTable('schedule_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  dayType: text('day_type', { enum: ['workday', 'weekend', 'day_off', 'show_day'] }).notNull().default('workday'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const scheduleTemplateBlocks = sqliteTable('schedule_template_blocks', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => scheduleTemplates.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  blockType: text('block_type', { enum: ['task', 'fixed', 'break', 'buffer'] }).notNull().default('fixed'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
});

// ─── Calendar Sync ─────────────────────────────────────────────
export const calendarSync = sqliteTable('calendar_sync', {
  id: text('id').primaryKey(),
  googleCalendarId: text('google_calendar_id'),
  syncDirection: text('sync_direction', { enum: ['push_only', 'pull_only', 'bidirectional'] }).notNull().default('push_only'),
  lastSyncedAt: text('last_synced_at'),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const calendarEventMappings = sqliteTable('calendar_event_mappings', {
  id: text('id').primaryKey(),
  calendarSyncId: text('calendar_sync_id').notNull().references(() => calendarSync.id, { onDelete: 'cascade' }),
  scheduleEntryId: text('schedule_entry_id').references(() => scheduleEntries.id, { onDelete: 'set null' }),
  timeBlockId: text('time_block_id').references(() => timeBlocks.id, { onDelete: 'set null' }),
  googleEventId: text('google_event_id'),
  syncStatus: text('sync_status', { enum: ['synced', 'pending', 'conflict', 'error'] }).notNull().default('pending'),
  lastSyncedAt: text('last_synced_at'),
});
