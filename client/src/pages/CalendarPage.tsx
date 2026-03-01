import { useState, useEffect } from 'react';
import { schedulesApi, timeBlocksApi, projectsApi, tasksApi } from '../api/client';
import { ScheduleDay, TimeBlock, Task, Project, PROJECT_TYPE_COLORS } from '../types';
import { getWeekDates, formatDateShort, formatTime, isToday, getToday, generateTimeSlots } from '../utils/time';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

export function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [days, setDays] = useState<Record<string, ScheduleDay>>({});
  const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [assigningTask, setAssigningTask] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);

  const loadData = async () => {
    try {
      const from = weekDates[0];
      const to = weekDates[6];
      const dayList = await schedulesApi.getDays({ from, to });
      const dayMap: Record<string, ScheduleDay> = {};
      if (Array.isArray(dayList)) {
        dayList.forEach((d: ScheduleDay) => { dayMap[d.date] = d; });
      }
      setDays(dayMap);

      // Load blocks for each day
      const blockMap: Record<string, TimeBlock[]> = {};
      for (const date of weekDates) {
        try {
          const dayData = await schedulesApi.getDays({ date });
          if (dayData && dayData.timeBlocks) {
            blockMap[date] = dayData.timeBlocks;
          }
        } catch { /* day doesn't exist yet */ }
      }
      setBlocks(blockMap);

      const [projectList, taskList] = await Promise.all([
        projectsApi.list({ status: 'active' }),
        tasksApi.list(),
      ]);
      setProjects(projectList);
      setAllTasks(taskList);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [weekOffset]);

  const handleCreateDay = async (date: string) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'workday';
    await schedulesApi.createDay({ date, dayType });
    loadData();
  };

  const handleAssignBlock = async (date: string, timeSlot: string) => {
    if (!assigningTask) return;

    const day = days[date];
    if (!day) return;

    const task = allTasks.find(t => t.id === assigningTask);
    if (!task) return;

    const startTime = `${date}T${timeSlot}:00`;
    const [h, m] = timeSlot.split(':').map(Number);
    const endMinutes = h * 60 + m + 30;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endTime = `${date}T${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`;

    await timeBlocksApi.create({
      taskId: task.id,
      projectId: task.projectId,
      scheduleDayId: day.id,
      blockType: 'task',
      startTime,
      endTime,
      status: 'assigned',
    });
    loadData();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-katsu-text">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-katsu-surface-2 rounded">
            <ChevronLeft size={18} className="text-katsu-text-muted" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-sm text-katsu-text-muted hover:text-katsu-text px-2"
          >
            This Week
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-katsu-surface-2 rounded">
            <ChevronRight size={18} className="text-katsu-text-muted" />
          </button>
        </div>
      </div>

      {/* Task selector for assigning blocks */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-katsu-text-dim">Assign:</span>
        <select
          value={assigningTask || ''}
          onChange={e => setAssigningTask(e.target.value || null)}
          className="bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text"
        >
          <option value="">Select a task to assign...</option>
          {allTasks.filter(t => t.status !== 'complete').map(task => {
            const project = projects.find(p => p.id === task.projectId);
            return (
              <option key={task.id} value={task.id}>
                {project ? `${project.name}: ` : ''}{task.name}
              </option>
            );
          })}
        </select>
        {assigningTask && (
          <button onClick={() => setAssigningTask(null)} className="text-xs text-katsu-text-dim hover:text-katsu-text">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map(date => {
          const day = days[date];
          const dayBlocks = blocks[date] || [];
          const todayHighlight = isToday(date);

          return (
            <div
              key={date}
              className={`bg-katsu-surface rounded-lg border ${todayHighlight ? 'border-katsu-accent' : 'border-katsu-border'} overflow-hidden`}
            >
              <div className={`px-2 py-1.5 text-center border-b ${todayHighlight ? 'border-katsu-accent bg-katsu-accent/5' : 'border-katsu-border'}`}>
                <div className="text-xs text-katsu-text-dim">{formatDateShort(date)}</div>
              </div>

              <div className="p-1.5 space-y-0.5 min-h-[120px] max-h-[300px] overflow-y-auto">
                {day ? (
                  dayBlocks.length > 0 ? (
                    dayBlocks.map(block => {
                      const color = block.projectId
                        ? PROJECT_TYPE_COLORS[projects.find(p => p.id === block.projectId)?.projectType || 'other'] || '#9CA3AF'
                        : block.blockType === 'fixed' ? '#374151' : block.blockType === 'break' ? '#D1D5DB' : '#F3F4F6';

                      const task = block.taskId ? allTasks.find(t => t.id === block.taskId) : null;

                      return (
                        <div
                          key={block.id}
                          className={`rounded px-1.5 py-1 text-xs ${block.status === 'done' ? 'opacity-50' : ''}`}
                          style={{ backgroundColor: color + '20', borderLeft: `2px solid ${color}` }}
                        >
                          <div className="truncate text-katsu-text" style={{ fontSize: '10px' }}>
                            {task ? task.name : block.label || block.blockType}
                          </div>
                          <div className="text-katsu-text-dim" style={{ fontSize: '9px' }}>
                            {formatTime(block.startTime)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-katsu-text-dim text-center py-4">
                      {assigningTask ? (
                        <div className="space-y-0.5">
                          {generateTimeSlots(day.availableStart, day.availableEnd).slice(0, 10).map(slot => (
                            <button
                              key={slot}
                              onClick={() => handleAssignBlock(date, slot)}
                              className="block w-full text-left px-1.5 py-0.5 hover:bg-katsu-accent/10 rounded text-katsu-text-dim hover:text-katsu-accent"
                              style={{ fontSize: '10px' }}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      ) : (
                        'No blocks'
                      )}
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => handleCreateDay(date)}
                    className="w-full text-center py-4 text-xs text-katsu-text-dim hover:text-katsu-accent"
                  >
                    <Plus size={14} className="mx-auto mb-1" />
                    Add day
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Detail (Mobile-friendly) */}
      {selectedDay && (
        <div className="mt-6 bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-katsu-text">{formatDateShort(selectedDay)}</h2>
            <button onClick={() => setSelectedDay(null)} className="text-katsu-text-dim hover:text-katsu-text">
              <X size={16} />
            </button>
          </div>
          {/* Block list for selected day */}
          {(blocks[selectedDay] || []).map(block => (
            <div key={block.id} className="flex items-center gap-2 py-1.5 text-sm border-b border-katsu-border last:border-b-0">
              <span className="text-xs text-katsu-text-dim font-mono w-16">{formatTime(block.startTime)}</span>
              <span className="text-katsu-text">{block.label || allTasks.find(t => t.id === block.taskId)?.name || block.blockType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
