export interface ProjectType {
  id: string;
  name: string;
  slug: string;
  color: string;
  isDefault: boolean;
}

export type ProjectStatus = 'active' | 'paused' | 'complete' | 'shelved' | 'abandoned';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'partial' | 'skipped' | 'overdue';
export type BlockType = 'task' | 'fixed' | 'break' | 'buffer';
export type BlockStatus = 'empty' | 'assigned' | 'done' | 'skipped';
export type DayType = 'workday' | 'weekend' | 'day_off' | 'show_day';
export type NoteType = 'idea' | 'decision' | 'blocker' | 'progress' | 'general';
export type FocusMode = 'free' | 'pomodoro';
export type FocusStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  projectType: string;
  status: ProjectStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  targetDeadline: string | null;
  tags: string[];
  notes: string | null;
  parentProjectId: string | null;
  clonedFromId: string | null;
  // Computed
  completionPercent?: number;
  totalTasks?: number;
  completedTasks?: number;
  totalEstimatedMinutes?: number;
  totalActualMinutes?: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  projectId: string;
  templateTaskId: string | null;
  name: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  startedOnTime: boolean | null;
  completedOnTime: boolean | null;
  durationEstimate: number | null;
  durationActual: number;
  isMilestone: boolean;
  dependsOn: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed
  blocksAssigned?: number;
  blocksCompleted?: number;
  sessionLabel?: string | null;
}

export interface TimeBlock {
  id: string;
  taskId: string | null;
  projectId: string | null;
  scheduleDayId: string;
  label: string | null;
  blockType: BlockType;
  startTime: string;
  endTime: string;
  status: BlockStatus;
  notes: string | null;
  createdAt: string;
}

export interface ScheduleDay {
  id: string;
  date: string;
  dayType: DayType;
  title: string | null;
  subtitle: string | null;
  availableStart: string;
  availableEnd: string;
  notes: string | null;
  createdAt: string;
  // Enriched
  timeBlocks?: TimeBlock[];
  totalAvailableMinutes?: number;
  totalScheduledMinutes?: number;
}

export interface ScheduleEntry {
  id: string;
  taskId: string | null;
  projectId: string | null;
  title: string;
  blockType: BlockType;
  recurrenceRule: string;
  startTime: string;
  endTime: string;
  reminderOffset: number;
  active: boolean;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  taskId: string;
  projectId: string;
  mode: FocusMode;
  startedAt: string;
  endedAt: string | null;
  targetDuration: number | null;
  actualDuration: number | null;
  breakDuration: number;
  pomodoroCount: number;
  pauses: Array<{ pausedAt: string; resumedAt: string | null }>;
  status: FocusStatus;
  syncStatus: string;
  createdAt: string;
}

export interface SessionNote {
  id: string;
  projectId: string;
  taskId: string | null;
  focusSessionId: string | null;
  content: string;
  noteType: NoteType;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsOverview {
  activeProjects: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  completedThisWeek: number;
  completedThisMonth: number;
  onTimeStartRate: number;
  onTimeCompletionRate: number;
  blockCompletionRate: number;
  totalBlocks: number;
  doneBlocks: number;
  skippedBlocks: number;
  totalFocusMinutes: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  estimationAccuracy: number;
  streak: number;
}

export interface ProjectAnalytics {
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  totalBlocks: number;
  doneBlocks: number;
  blockCompletionRate: number;
  scheduledToDateMinutes: number;
  actualToDateMinutes: number;
  pace: 'ahead' | 'on_track' | 'behind';
  totalFocusMinutes: number;
}

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  music_production: '#FACC15',
  web_development: '#3B82F6',
  digital_art: '#A855F7',
  writing: '#10B981',
  video: '#EF4444',
  performance: '#F59E0B',
  research: '#06B6D4',
  hardware: '#64748B',
  other: '#9CA3AF',
};

export const PROJECT_TYPE_NAMES: Record<string, string> = {
  music_production: 'Music Production',
  web_development: 'Web Development',
  digital_art: 'Digital Art',
  writing: 'Writing',
  video: 'Video',
  performance: 'Performance',
  research: 'Research',
  hardware: 'Hardware',
  other: 'Other',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#64748B',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#64748B',
  in_progress: '#3B82F6',
  complete: '#10B981',
  partial: '#F59E0B',
  skipped: '#9CA3AF',
  overdue: '#EF4444',
};
