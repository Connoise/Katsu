import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { schedulesApi, projectsApi, tasksApi, timeBlocksApi } from '../api/client';
import { TimeBlock, Task, Project, PROJECT_TYPE_COLORS, STATUS_COLORS } from '../types';
import { formatTime, getToday, formatMinutes, formatDate } from '../utils/time';
import { Clock, Check, SkipForward, Timer, StickyNote, ChevronRight, AlertTriangle } from 'lucide-react';

export function TodayPage() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const today = getToday();

  const loadData = async () => {
    try {
      const dayData = await schedulesApi.getDays({ date: today });
      if (dayData && dayData.timeBlocks) {
        setBlocks(dayData.timeBlocks);
      } else {
        // Create today's schedule day if it doesn't exist
        const dayOfWeek = new Date().getDay();
        const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'workday';
        await schedulesApi.createDay({ date: today, dayType });
        setBlocks([]);
      }

      const allTasks = await tasksApi.list();
      const taskMap: Record<string, Task> = {};
      allTasks.forEach((t: Task) => { taskMap[t.id] = t; });
      setTasks(taskMap);

      const allProjects = await projectsApi.list();
      const projectMap: Record<string, Project> = {};
      allProjects.forEach((p: Project) => { projectMap[p.id] = p; });
      setProjects(projectMap);
    } catch (err) {
      console.error('Failed to load today data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleBlockStatus = async (block: TimeBlock, newStatus: 'done' | 'skipped') => {
    await timeBlocksApi.update(block.id, { status: newStatus });
    loadData();
  };

  const now = new Date();
  const sortedBlocks = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const taskBlocks = sortedBlocks.filter(b => b.blockType === 'task');
  const doneCount = taskBlocks.filter(b => b.status === 'done').length;
  const totalCount = taskBlocks.length;
  const totalMinutes = totalCount * 30;
  const doneMinutes = doneCount * 30;
  const remainingMinutes = totalMinutes - doneMinutes;

  // Determine current block
  const currentBlockIndex = sortedBlocks.findIndex(b => {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    return now >= start && now < end;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-katsu-text-dim">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {/* Day Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-katsu-text">{formatDate(today)}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-katsu-text-muted">
          <span>{totalCount} blocks scheduled</span>
          <span>{doneCount} completed</span>
          <span>{formatMinutes(remainingMinutes)} remaining</span>
        </div>
        {totalCount > 0 && (
          <div className="w-full h-2 bg-katsu-surface-3 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-katsu-accent rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Timeline */}
      {sortedBlocks.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={40} className="mx-auto text-katsu-text-dim mb-3" />
          <p className="text-katsu-text-muted">No blocks scheduled for today</p>
          <Link to="/calendar" className="text-sm text-katsu-accent hover:underline mt-2 inline-block">
            Open Calendar to plan your day
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {sortedBlocks.map((block, index) => {
            const task = block.taskId ? tasks[block.taskId] : null;
            const project = block.projectId ? projects[block.projectId] : null;
            const color = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#374151';
            const isPast = new Date(block.endTime) < now;
            const isCurrent = index === currentBlockIndex;
            const isUpcoming = new Date(block.startTime) > now;

            return (
              <div
                key={block.id}
                className={`flex items-stretch gap-3 rounded-lg border transition-all ${
                  isCurrent
                    ? 'border-katsu-accent bg-katsu-surface-2 shadow-lg shadow-katsu-accent/5'
                    : isPast
                    ? 'border-katsu-border bg-katsu-surface opacity-60'
                    : 'border-katsu-border bg-katsu-surface'
                }`}
              >
                {/* Color bar */}
                <div className="w-1 rounded-l-lg flex-shrink-0" style={{ backgroundColor: color }} />

                <div className="flex-1 py-2.5 pr-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-katsu-text-dim font-mono w-20 flex-shrink-0">
                        {formatTime(block.startTime)}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm text-katsu-text truncate block">
                          {block.blockType === 'task' && task ? task.name : block.label || block.blockType}
                        </span>
                        {project && (
                          <span className="text-xs text-katsu-text-dim">{project.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {block.blockType === 'task' && block.status !== 'done' && block.status !== 'skipped' && (
                        <>
                          <button
                            onClick={() => handleBlockStatus(block, 'done')}
                            className="p-1.5 text-green-400 hover:bg-green-400/10 rounded transition-colors"
                            title="Mark done"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => handleBlockStatus(block, 'skipped')}
                            className="p-1.5 text-katsu-text-dim hover:bg-katsu-surface-3 rounded transition-colors"
                            title="Skip"
                          >
                            <SkipForward size={14} />
                          </button>
                        </>
                      )}
                      {block.status === 'done' && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <Check size={12} /> Done
                        </span>
                      )}
                      {block.status === 'skipped' && (
                        <span className="text-xs text-katsu-text-dim flex items-center gap-1">
                          <SkipForward size={12} /> Skipped
                        </span>
                      )}
                    </div>
                  </div>

                  {isCurrent && task && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => navigate(`/focus?taskId=${task.id}&projectId=${task.projectId}`)}
                        className="text-xs px-3 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover transition-colors"
                      >
                        <Timer size={12} className="inline mr-1" /> Start Focus Session
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
