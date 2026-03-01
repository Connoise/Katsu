import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'katsu.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite: DatabaseType = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS project_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      project_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      archived_at TEXT,
      target_deadline TEXT,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      parent_project_id TEXT,
      cloned_from_id TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      template_task_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      "order" INTEGER NOT NULL DEFAULT 0,
      scheduled_start TEXT,
      scheduled_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      started_on_time INTEGER,
      completed_on_time INTEGER,
      duration_estimate INTEGER,
      duration_actual INTEGER DEFAULT 0,
      is_milestone INTEGER DEFAULT 0,
      depends_on TEXT DEFAULT '[]',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_days (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      day_type TEXT NOT NULL DEFAULT 'workday',
      title TEXT,
      subtitle TEXT,
      available_start TEXT NOT NULL DEFAULT '08:00',
      available_end TEXT NOT NULL DEFAULT '23:00',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_blocks (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      schedule_day_id TEXT NOT NULL REFERENCES schedule_days(id) ON DELETE CASCADE,
      label TEXT,
      block_type TEXT NOT NULL DEFAULT 'task',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'empty',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      block_type TEXT NOT NULL,
      recurrence_rule TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reminder_offset INTEGER DEFAULT 5,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      time_block_id TEXT REFERENCES time_blocks(id) ON DELETE SET NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      deep_link TEXT,
      response TEXT,
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'free',
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      target_duration INTEGER,
      actual_duration INTEGER,
      break_duration INTEGER DEFAULT 0,
      pomodoro_count INTEGER DEFAULT 0,
      pauses TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      sync_status TEXT NOT NULL DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      focus_session_id TEXT REFERENCES focus_sessions(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      note_type TEXT NOT NULL DEFAULT 'general',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS archive_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      archived_at TEXT DEFAULT (datetime('now')),
      reason TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS project_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      project_type TEXT NOT NULL,
      default_tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_from_id TEXT
    );

    CREATE TABLE IF NOT EXISTS template_tasks (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      duration_estimate INTEGER,
      session_count INTEGER,
      block_size INTEGER DEFAULT 30,
      is_milestone INTEGER DEFAULT 0,
      depends_on_order TEXT DEFAULT '[]',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_sync (
      id TEXT PRIMARY KEY,
      google_calendar_id TEXT,
      sync_direction TEXT NOT NULL DEFAULT 'push_only',
      last_synced_at TEXT,
      sync_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_event_mappings (
      id TEXT PRIMARY KEY,
      calendar_sync_id TEXT NOT NULL REFERENCES calendar_sync(id) ON DELETE CASCADE,
      schedule_entry_id TEXT REFERENCES schedule_entries(id) ON DELETE SET NULL,
      time_block_id TEXT REFERENCES time_blocks(id) ON DELETE SET NULL,
      google_event_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      last_synced_at TEXT
    );
  `);

  seedDefaultProjectTypes();
}

function seedDefaultProjectTypes() {
  const count = sqlite.prepare('SELECT COUNT(*) as count FROM project_types').get() as { count: number };
  if (count.count > 0) return;

  const defaults = [
    { id: 'pt-1', name: 'Music Production', slug: 'music_production', color: '#FACC15' },
    { id: 'pt-2', name: 'Web Development', slug: 'web_development', color: '#3B82F6' },
    { id: 'pt-3', name: 'Digital Art', slug: 'digital_art', color: '#A855F7' },
    { id: 'pt-4', name: 'Writing', slug: 'writing', color: '#10B981' },
    { id: 'pt-5', name: 'Video', slug: 'video', color: '#EF4444' },
    { id: 'pt-6', name: 'Performance', slug: 'performance', color: '#F59E0B' },
    { id: 'pt-7', name: 'Research', slug: 'research', color: '#06B6D4' },
    { id: 'pt-8', name: 'Hardware', slug: 'hardware', color: '#64748B' },
    { id: 'pt-9', name: 'Other', slug: 'other', color: '#9CA3AF' },
  ];

  const insert = sqlite.prepare(
    'INSERT INTO project_types (id, name, slug, color, is_default) VALUES (?, ?, ?, ?, 1)'
  );
  for (const pt of defaults) {
    insert.run(pt.id, pt.name, pt.slug, pt.color);
  }
}
