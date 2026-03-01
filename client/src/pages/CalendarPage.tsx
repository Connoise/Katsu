import { useState, useEffect } from 'react';
import { schedulesApi, timeBlocksApi, projectsApi, tasksApi } from '../api/client';
import { ScheduleDay, TimeBlock, Task, Project, PROJECT_TYPE_COLORS, DayType } from '../types';
import { getWeekDates, formatDateShort, formatTimeSlot, isToday, generateFullDaySlots, formatDate } from '../utils/time';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Settings, Check, SkipForward } from 'lucide-react';

export function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [days, setDays] = useState<Record<string, ScheduleDay>>({});
  const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [assigningTask, setAssigningTask] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editDayType, setEditDayType] = useState<DayType>('workday');
  const [editDayTitle, setEditDayTitle] = useState('');
  const [editDayNotes, setEditDayNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const allSlots = generateFullDaySlots();

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
    await schedulesApi.createDay({ date, dayType, availableStart: '00:00', availableEnd: '23:30' });
    await loadData();
    setExpandedDay(date);
  };

  const handleAssignBlock = async (date: string, timeSlot: string) => {
    if (!assigningTask) return;
    let day = days[date];
    if (!day) {
      await handleCreateDay(date);
      // Re-fetch to get the newly created day
      const dayData = await schedulesApi.getDays({ date });
      if (!dayData) return;
      day = dayData;
    }

    const task = allTasks.find(t => t.id === assigningTask);
    if (!task) return;

    const startTime = `${date}T${timeSlot}:00`;
    const [h, m] = timeSlot.split(':').map(Number);
    const endMinutes = h * 60 + m + 30;
    const endH = Math.floor(endMinutes / 60) % 24;
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

  const handleDeleteBlock = async (blockId: string) => {
    await timeBlocksApi.delete(blockId);
    loadData();
  };

  const handleBlockStatus = async (blockId: string, status: 'done' | 'skipped' | 'assigned') => {
    await timeBlocksApi.update(blockId, { status });
    loadData();
  };

  const handleEditDay = (date: string) => {
    const day = days[date];
    if (!day) return;
    setEditingDay(date);
    setEditDayType(day.dayType);
    setEditDayTitle(day.title || '');
    setEditDayNotes(day.notes || '');
  };

  const handleSaveDay = async () => {
    if (!editingDay) return;
    const day = days[editingDay];
    if (!day) return;
    await schedulesApi.updateDay(day.id, {
      dayType: editDayType,
      title: editDayTitle || null,
      notes: editDayNotes || null,
    });
    setEditingDay(null);
    loadData();
  };

  const getBlockForSlot = (date: string, slot: string): TimeBlock | undefined => {
    const dayBlocks = blocks[date] || [];
    return dayBlocks.find(b => {
      const blockSlot = b.startTime.split('T')[1]?.substring(0, 5);
      return blockSlot === slot;
    });
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
          <button onClick={() => setWeekOffset(0)} className="text-sm text-katsu-text-muted hover:text-katsu-text px-2">
            This Week
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-katsu-surface-2 rounded">
            <ChevronRight size={18} className="text-katsu-text-muted" />
          </button>
        </div>
      </div>

      {/* Task selector */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-katsu-text-dim">Assign task:</span>
        <select
          value={assigningTask || ''}
          onChange={e => setAssigningTask(e.target.value || null)}
          className="bg-katsu-surface border border-katsu-border rounded px-2 py-1.5 text-xs text-katsu-text focus:outline-none focus:border-katsu-accent"
        >
          <option value="">Select a task...</option>
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

      {/* Week Grid — compact view */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDates.map(date => {
          const day = days[date];
          const dayBlocks = blocks[date] || [];
          const todayHighlight = isToday(date);
          const isExpanded = expandedDay === date;
          const taskBlocks = dayBlocks.filter(b => b.blockType === 'task');

          return (
            <div
              key={date}
              className={`bg-katsu-surface rounded-lg border ${todayHighlight ? 'border-katsu-accent' : 'border-katsu-border'} overflow-hidden cursor-pointer hover:border-katsu-border-light transition-colors`}
              onClick={() => {
                if (!day) {
                  handleCreateDay(date);
                } else {
                  setExpandedDay(isExpanded ? null : date);
                }
              }}
            >
              <div className={`px-2 py-1.5 text-center border-b ${todayHighlight ? 'border-katsu-accent bg-katsu-accent/5' : 'border-katsu-border'}`}>
                <div className="text-xs text-katsu-text-dim">{formatDateShort(date)}</div>
                {day && (
                  <div className="text-xs text-katsu-text-dim capitalize" style={{ fontSize: '9px' }}>{day.dayType}</div>
                )}
              </div>

              <div className="p-1.5 space-y-0.5 min-h-[80px]">
                {day ? (
                  taskBlocks.length > 0 ? (
                    taskBlocks.slice(0, 6).map(block => {
                      const project = projects.find(p => p.id === block.projectId);
                      const color = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#9CA3AF';
                      const task = block.taskId ? allTasks.find(t => t.id === block.taskId) : null;

                      return (
                        <div
                          key={block.id}
                          className={`rounded px-1.5 py-0.5 text-xs ${block.status === 'done' ? 'opacity-50' : ''}`}
                          style={{ backgroundColor: color + '20', borderLeft: `2px solid ${color}` }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="truncate text-katsu-text" style={{ fontSize: '10px' }}>
                            {task ? task.name : block.label || block.blockType}
                          </div>
                          <div className="text-katsu-text-dim" style={{ fontSize: '9px' }}>
                            {formatTimeSlot(block.startTime.split('T')[1]?.substring(0, 5) || '00:00')}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-katsu-text-dim text-center py-3">No blocks</div>
                  )
                ) : (
                  <div className="text-xs text-katsu-text-dim text-center py-3">
                    <Plus size={14} className="mx-auto mb-1" />
                    Click to add
                  </div>
                )}
                {taskBlocks.length > 6 && (
                  <div className="text-xs text-katsu-text-dim text-center" style={{ fontSize: '9px' }}>
                    +{taskBlocks.length - 6} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Day View — full schedule */}
      {expandedDay && days[expandedDay] && (
        <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-katsu-text">{formatDate(expandedDay)}</h2>
              {days[expandedDay].title && (
                <p className="text-xs text-katsu-text-dim">{days[expandedDay].title}</p>
              )}
              <span className="text-xs text-katsu-text-dim capitalize">{days[expandedDay].dayType}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleEditDay(expandedDay)}
                className="p-1.5 text-katsu-text-dim hover:text-katsu-text hover:bg-katsu-surface-2 rounded"
                title="Edit day settings"
              >
                <Settings size={14} />
              </button>
              <button onClick={() => setExpandedDay(null)} className="p-1.5 text-katsu-text-dim hover:text-katsu-text hover:bg-katsu-surface-2 rounded">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Edit Day Modal */}
          {editingDay === expandedDay && (
            <div className="bg-katsu-surface-2 rounded border border-katsu-border p-3 mb-4 space-y-2">
              <h3 className="text-xs font-medium text-katsu-text">Edit Day</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-katsu-text-dim mb-0.5">Day Type</label>
                  <select value={editDayType} onChange={e => setEditDayType(e.target.value as DayType)}
                    className="w-full bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text">
                    <option value="workday">Workday</option>
                    <option value="weekend">Weekend</option>
                    <option value="day_off">Day Off</option>
                    <option value="show_day">Show Day</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-katsu-text-dim mb-0.5">Title</label>
                  <input type="text" value={editDayTitle} onChange={e => setEditDayTitle(e.target.value)}
                    placeholder="e.g. Big Production Day"
                    className="w-full bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-katsu-text-dim mb-0.5">Notes</label>
                <textarea value={editDayNotes} onChange={e => setEditDayNotes(e.target.value)} rows={2}
                  className="w-full bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveDay} className="text-xs px-3 py-1 bg-katsu-accent text-black rounded hover:bg-katsu-accent-hover">Save</button>
                <button onClick={() => setEditingDay(null)} className="text-xs px-3 py-1 text-katsu-text-muted">Cancel</button>
              </div>
            </div>
          )}

          {/* Full 24h time slot list */}
          <div className="max-h-[600px] overflow-y-auto space-y-0.5">
            {allSlots.map(slot => {
              const block = getBlockForSlot(expandedDay, slot);
              const task = block?.taskId ? allTasks.find(t => t.id === block.taskId) : null;
              const project = block?.projectId ? projects.find(p => p.id === block.projectId) : null;
              const color = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#374151';

              return (
                <div key={slot} className="flex items-center gap-2 group">
                  <span className="text-xs text-katsu-text-dim font-mono w-20 flex-shrink-0 text-right pr-2">
                    {formatTimeSlot(slot)}
                  </span>

                  {block ? (
                    <div
                      className={`flex-1 flex items-center gap-2 rounded px-2 py-1.5 ${block.status === 'done' ? 'opacity-50' : ''}`}
                      style={{ backgroundColor: color + '15', borderLeft: `3px solid ${color}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-katsu-text truncate">
                          {task ? task.name : block.label || block.blockType}
                        </div>
                        {project && <div className="text-katsu-text-dim" style={{ fontSize: '10px' }}>{project.name}</div>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {block.status === 'done' ? (
                          <span className="text-xs text-green-400 flex items-center gap-0.5"><Check size={10} />Done</span>
                        ) : block.status === 'skipped' ? (
                          <span className="text-xs text-katsu-text-dim flex items-center gap-0.5"><SkipForward size={10} />Skipped</span>
                        ) : (
                          <>
                            <button onClick={() => handleBlockStatus(block.id, 'done')} className="p-1 text-green-400 hover:bg-green-400/10 rounded" title="Done">
                              <Check size={12} />
                            </button>
                            <button onClick={() => handleBlockStatus(block.id, 'skipped')} className="p-1 text-katsu-text-dim hover:bg-katsu-surface-3 rounded" title="Skip">
                              <SkipForward size={12} />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteBlock(block.id)} className="p-1 text-red-400 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100" title="Remove">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex-1 rounded px-2 py-1.5 border border-transparent transition-colors ${
                        assigningTask
                          ? 'hover:bg-katsu-accent/10 hover:border-katsu-accent/30 cursor-pointer'
                          : 'hover:bg-katsu-surface-2'
                      }`}
                      onClick={() => assigningTask && handleAssignBlock(expandedDay, slot)}
                    >
                      {assigningTask ? (
                        <span className="text-xs text-katsu-text-dim">Click to assign</span>
                      ) : (
                        <span className="text-xs text-katsu-text-dim opacity-0 group-hover:opacity-50">—</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
