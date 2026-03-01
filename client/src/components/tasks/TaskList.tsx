import { useState } from 'react';
import { Task, STATUS_COLORS, TaskStatus } from '../../types';
import { formatMinutes } from '../../utils/time';
import { tasksApi } from '../../api/client';
import {
  GripVertical, Plus, Check, Clock, AlertTriangle, SkipForward,
  Trash2, ChevronDown, ChevronRight, Flag, Pencil, Timer
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  projectId: string;
  onUpdate: () => void;
  onStartFocus?: (task: Task) => void;
}

const statusIcons: Record<TaskStatus, any> = {
  pending: Clock,
  in_progress: Timer,
  complete: Check,
  partial: AlertTriangle,
  skipped: SkipForward,
  overdue: AlertTriangle,
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
  partial: 'Partial',
  skipped: 'Skipped',
  overdue: 'Overdue',
};

export function TaskList({ tasks, projectId, onUpdate, onStartFocus }: TaskListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    await tasksApi.create({
      projectId,
      name: newTaskName.trim(),
      description: newTaskDesc.trim() || null,
      durationEstimate: newTaskDuration ? parseInt(newTaskDuration) : null,
    });
    setNewTaskName('');
    setNewTaskDuration('');
    setNewTaskDesc('');
    setShowAddForm(false);
    onUpdate();
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    await tasksApi.update(task.id, { status: newStatus });
    onUpdate();
  };

  const handleDelete = async (taskId: string) => {
    await tasksApi.delete(taskId);
    onUpdate();
  };

  const getNextStatus = (status: TaskStatus): TaskStatus => {
    switch (status) {
      case 'pending': return 'in_progress';
      case 'in_progress': return 'complete';
      case 'partial': return 'in_progress';
      case 'skipped': return 'pending';
      case 'overdue': return 'in_progress';
      default: return 'pending';
    }
  };

  return (
    <div>
      <div className="space-y-1">
        {tasks.map((task) => {
          const StatusIcon = statusIcons[task.status];
          const isExpanded = expandedId === task.id;

          return (
            <div key={task.id} className="bg-katsu-surface-2 rounded border border-katsu-border">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                  className="text-katsu-text-dim hover:text-katsu-text"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                <button
                  onClick={() => handleStatusChange(task, getNextStatus(task.status))}
                  className="flex-shrink-0"
                  title={`Status: ${statusLabels[task.status]} — click to advance`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors"
                    style={{
                      borderColor: STATUS_COLORS[task.status],
                      backgroundColor: task.status === 'complete' ? STATUS_COLORS[task.status] : 'transparent',
                    }}
                  >
                    {task.status === 'complete' && <Check size={12} className="text-white" />}
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${task.status === 'complete' ? 'line-through text-katsu-text-dim' : 'text-katsu-text'}`}>
                      {task.name}
                    </span>
                    {task.isMilestone && <Flag size={12} className="text-katsu-accent flex-shrink-0" />}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.sessionLabel && (
                    <span className="text-xs text-katsu-text-dim">{task.sessionLabel}</span>
                  )}
                  {task.durationEstimate && (
                    <span className="text-xs text-katsu-text-dim">{formatMinutes(task.durationEstimate)}</span>
                  )}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: STATUS_COLORS[task.status] + '20', color: STATUS_COLORS[task.status] }}
                  >
                    {statusLabels[task.status]}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-katsu-border space-y-2 pt-2">
                  {task.description && (
                    <p className="text-xs text-katsu-text-dim">{task.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-katsu-text-dim">
                    {task.durationEstimate && <span>Est: {formatMinutes(task.durationEstimate)}</span>}
                    {task.durationActual > 0 && <span>Actual: {formatMinutes(task.durationActual)}</span>}
                    {task.sessionLabel && <span>{task.sessionLabel}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    {onStartFocus && task.status !== 'complete' && (
                      <button
                        onClick={() => onStartFocus(task)}
                        className="text-xs px-2 py-1 bg-katsu-accent text-black rounded hover:bg-katsu-accent-hover transition-colors"
                      >
                        <Timer size={12} className="inline mr-1" />
                        Focus
                      </button>
                    )}
                    {task.status !== 'complete' && (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                        className="text-xs bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-katsu-text"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="partial">Partial</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-xs px-2 py-1 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      <Trash2 size={12} className="inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddForm ? (
        <form onSubmit={handleAddTask} className="mt-2 bg-katsu-surface-2 rounded border border-katsu-border p-3 space-y-2">
          <input
            type="text"
            value={newTaskName}
            onChange={e => setNewTaskName(e.target.value)}
            placeholder="Task name"
            autoFocus
            className="w-full bg-katsu-surface border border-katsu-border rounded px-2 py-1.5 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={newTaskDuration}
              onChange={e => setNewTaskDuration(e.target.value)}
              placeholder="Duration (min)"
              className="w-32 bg-katsu-surface border border-katsu-border rounded px-2 py-1.5 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
            />
            <input
              type="text"
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 bg-katsu-surface border border-katsu-border rounded px-2 py-1.5 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-xs px-3 py-1.5 bg-katsu-accent text-black rounded hover:bg-katsu-accent-hover">
              Add Task
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-xs px-3 py-1.5 text-katsu-text-muted hover:text-katsu-text">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-2 flex items-center gap-1 text-xs text-katsu-text-dim hover:text-katsu-accent transition-colors py-1"
        >
          <Plus size={14} /> Add task
        </button>
      )}
    </div>
  );
}
