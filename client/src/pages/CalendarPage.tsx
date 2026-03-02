import { useState, useEffect, useRef } from 'react';
import { schedulesApi, timeBlocksApi, projectsApi, tasksApi } from '../api/client';
import { ScheduleDay, TimeBlock, Task, Project, PROJECT_TYPE_COLORS, DayType } from '../types';
import {
  getWeekDates, formatDateShort, formatTimeSlot, isToday, generateFullDaySlots,
  formatDate, timeToMinutes, minutesToTime, formatMinutes, slotSpan, addMinutesToSlot,
} from '../utils/time';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Settings, Check, SkipForward, GripVertical } from 'lucide-react';

const SLOT_HEIGHT = 32; // px per 30-min slot

export function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [days, setDays] = useState<Record<string, ScheduleDay>>({});
  const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editDayType, setEditDayType] = useState<DayType>('workday');
  const [editDayTitle, setEditDayTitle] = useState('');
  const [editDayNotes, setEditDayNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Drag state
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

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

  const ensureDay = async (date: string): Promise<ScheduleDay | null> => {
    let day = days[date];
    if (!day) {
      await handleCreateDay(date);
      const dayData = await schedulesApi.getDays({ date });
      if (!dayData) return null;
      return dayData;
    }
    return day;
  };

  const handleAssignBlock = async (date: string, timeSlot: string, taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const day = await ensureDay(date);
    if (!day) return;

    const duration = task.durationEstimate || 30;
    const startMinutes = timeToMinutes(timeSlot);
    const endMinutes = startMinutes + duration;
    const endSlot = minutesToTime(endMinutes % (24 * 60));

    await timeBlocksApi.create({
      taskId: task.id,
      projectId: task.projectId,
      scheduleDayId: day.id,
      blockType: 'task',
      startTime: `${date}T${timeSlot}:00`,
      endTime: `${date}T${endSlot}:00`,
      status: 'assigned',
    });
    loadData();
  };

  const handleMoveBlock = async (blockId: string, newSlot: string) => {
    // Find the block across all days
    let targetBlock: TimeBlock | undefined;
    for (const dayBlocks of Object.values(blocks)) {
      targetBlock = dayBlocks.find(b => b.id === blockId);
      if (targetBlock) break;
    }
    if (!targetBlock) return;

    const oldStartSlot = targetBlock.startTime.split('T')[1]?.substring(0, 5) || '00:00';
    const oldEndSlot = targetBlock.endTime.split('T')[1]?.substring(0, 5) || '00:30';
    const duration = timeToMinutes(oldEndSlot) - timeToMinutes(oldStartSlot);
    const actualDuration = duration > 0 ? duration : duration + 24 * 60;
    const newEndSlot = addMinutesToSlot(newSlot, actualDuration);
    const date = targetBlock.startTime.split('T')[0];

    await timeBlocksApi.update(blockId, {
      startTime: `${date}T${newSlot}:00`,
      endTime: `${date}T${newEndSlot}:00`,
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

  // Drag handlers
  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('application/task-id', taskId);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingTaskId(taskId);
  };

  const handleBlockDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('application/block-id', blockId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingBlockId(blockId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDraggingBlockId(null);
    setDragOverSlot(null);
  };

  const handleSlotDragOver = (e: React.DragEvent, slot: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggingBlockId ? 'move' : 'copy';
    setDragOverSlot(slot);
  };

  const handleSlotDrop = (e: React.DragEvent, date: string, slot: string) => {
    e.preventDefault();
    setDragOverSlot(null);
    setDraggingTaskId(null);
    setDraggingBlockId(null);

    const taskId = e.dataTransfer.getData('application/task-id');
    const blockId = e.dataTransfer.getData('application/block-id');

    if (taskId) {
      handleAssignBlock(date, slot, taskId);
    } else if (blockId) {
      handleMoveBlock(blockId, slot);
    }
  };

  // Compute block positions for expanded day
  const getBlockLayout = (date: string) => {
    const dayBlocks = blocks[date] || [];
    const layout: Array<{
      block: TimeBlock;
      startIdx: number;
      span: number;
      task: Task | undefined;
      project: Project | undefined;
    }> = [];

    for (const block of dayBlocks) {
      const startSlot = block.startTime.split('T')[1]?.substring(0, 5) || '00:00';
      const endSlot = block.endTime.split('T')[1]?.substring(0, 5) || '00:30';
      const startIdx = allSlots.indexOf(startSlot);
      const span = slotSpan(startSlot, endSlot);
      const task = block.taskId ? allTasks.find(t => t.id === block.taskId) : undefined;
      const project = block.projectId ? projects.find(p => p.id === block.projectId) : undefined;

      layout.push({ block, startIdx: Math.max(startIdx, 0), span, task, project });
    }

    return layout;
  };

  // Compute preview span for dragged task
  const getDragPreviewSpan = (): number => {
    if (!draggingTaskId) return 1;
    const task = allTasks.find(t => t.id === draggingTaskId);
    const duration = task?.durationEstimate || 30;
    return Math.max(Math.ceil(duration / 30), 1);
  };

  // Check if a slot index is covered by any block (for dimming)
  const isCoveredByBlock = (date: string, slotIdx: number): boolean => {
    const layout = getBlockLayout(date);
    return layout.some(({ startIdx, span }) => slotIdx >= startIdx && slotIdx < startIdx + span);
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

      {/* Draggable task panel */}
      {expandedDay && (
        <div className="mb-4">
          <div className="text-xs text-katsu-text-dim mb-1.5">Drag a task onto the schedule, or click a time slot after selecting one:</div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pb-1">
            {allTasks.filter(t => t.status !== 'complete').map(task => {
              const project = projects.find(p => p.id === task.projectId);
              const color = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#9CA3AF';
              const isDragging = draggingTaskId === task.id;
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleTaskDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-grab active:cursor-grabbing text-xs select-none transition-opacity ${isDragging ? 'opacity-40' : ''}`}
                  style={{ backgroundColor: color + '15', borderLeft: `3px solid ${color}` }}
                >
                  <GripVertical size={10} className="text-katsu-text-dim flex-shrink-0" />
                  <span className="text-katsu-text truncate max-w-[160px]">{task.name}</span>
                  {task.durationEstimate && (
                    <span className="text-katsu-text-dim flex-shrink-0">{formatMinutes(task.durationEstimate)}</span>
                  )}
                </div>
              );
            })}
            {allTasks.filter(t => t.status !== 'complete').length === 0 && (
              <span className="text-xs text-katsu-text-dim">No active tasks to schedule</span>
            )}
          </div>
        </div>
      )}

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
              className={`bg-katsu-surface rounded-lg border ${isExpanded ? 'border-katsu-accent' : todayHighlight ? 'border-katsu-accent/50' : 'border-katsu-border'} overflow-hidden cursor-pointer hover:border-katsu-border-light transition-colors`}
              onClick={() => {
                if (!day) {
                  handleCreateDay(date);
                } else {
                  setExpandedDay(isExpanded ? null : date);
                }
              }}
            >
              <div className={`px-2 py-1.5 text-center border-b ${isExpanded ? 'border-katsu-accent bg-katsu-accent/10' : todayHighlight ? 'border-katsu-accent/50 bg-katsu-accent/5' : 'border-katsu-border'}`}>
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
                      const startSlot = block.startTime.split('T')[1]?.substring(0, 5) || '00:00';
                      const endSlot = block.endTime.split('T')[1]?.substring(0, 5) || '00:30';

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
                            {formatTimeSlot(startSlot)} – {formatTimeSlot(endSlot)}
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

      {/* Expanded Day View — full schedule with drag-and-drop */}
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

          {/* Full 24h schedule with absolute-positioned blocks */}
          <ExpandedDaySchedule
            date={expandedDay}
            allSlots={allSlots}
            blockLayout={getBlockLayout(expandedDay)}
            dragOverSlot={dragOverSlot}
            draggingTaskId={draggingTaskId}
            draggingBlockId={draggingBlockId}
            getDragPreviewSpan={getDragPreviewSpan}
            onSlotDragOver={handleSlotDragOver}
            onSlotDrop={(e, slot) => handleSlotDrop(e, expandedDay, slot)}
            onSlotDragLeave={() => setDragOverSlot(null)}
            onBlockDragStart={handleBlockDragStart}
            onDragEnd={handleDragEnd}
            onBlockStatus={handleBlockStatus}
            onDeleteBlock={handleDeleteBlock}
          />
        </div>
      )}
    </div>
  );
}

// Separate component for the expanded day schedule to keep things clean
function ExpandedDaySchedule({
  date,
  allSlots,
  blockLayout,
  dragOverSlot,
  draggingTaskId,
  draggingBlockId,
  getDragPreviewSpan,
  onSlotDragOver,
  onSlotDrop,
  onSlotDragLeave,
  onBlockDragStart,
  onDragEnd,
  onBlockStatus,
  onDeleteBlock,
}: {
  date: string;
  allSlots: string[];
  blockLayout: Array<{
    block: TimeBlock;
    startIdx: number;
    span: number;
    task: Task | undefined;
    project: Project | undefined;
  }>;
  dragOverSlot: string | null;
  draggingTaskId: string | null;
  draggingBlockId: string | null;
  getDragPreviewSpan: () => number;
  onSlotDragOver: (e: React.DragEvent, slot: string) => void;
  onSlotDrop: (e: React.DragEvent, slot: string) => void;
  onSlotDragLeave: () => void;
  onBlockDragStart: (e: React.DragEvent, blockId: string) => void;
  onDragEnd: () => void;
  onBlockStatus: (blockId: string, status: 'done' | 'skipped' | 'assigned') => void;
  onDeleteBlock: (blockId: string) => void;
}) {
  const containerHeight = allSlots.length * SLOT_HEIGHT;
  const previewSpan = getDragPreviewSpan();

  // Compute drag preview slots (which slots will be highlighted)
  const dragPreviewSlots = new Set<string>();
  if (dragOverSlot) {
    const startIdx = allSlots.indexOf(dragOverSlot);
    if (startIdx >= 0) {
      const span = draggingBlockId ? getBlockSpanForId(draggingBlockId, blockLayout) : previewSpan;
      for (let i = 0; i < span && startIdx + i < allSlots.length; i++) {
        dragPreviewSlots.add(allSlots[startIdx + i]);
      }
    }
  }

  return (
    <div className="max-h-[700px] overflow-y-auto">
      <div className="flex">
        {/* Time labels column */}
        <div className="flex-shrink-0 w-20">
          {allSlots.map(slot => (
            <div key={slot} style={{ height: SLOT_HEIGHT }} className="flex items-center justify-end pr-2">
              <span className="text-xs text-katsu-text-dim font-mono">{formatTimeSlot(slot)}</span>
            </div>
          ))}
        </div>

        {/* Schedule column */}
        <div className="flex-1 relative" style={{ height: containerHeight }}>
          {/* Background slot rows — drop targets */}
          {allSlots.map((slot, idx) => {
            const isPreview = dragPreviewSlots.has(slot);
            const isHourBoundary = slot.endsWith(':00');

            return (
              <div
                key={slot}
                className={`absolute w-full transition-colors ${
                  isPreview ? 'bg-katsu-accent/15' : ''
                } ${isHourBoundary ? 'border-t border-katsu-border/30' : ''}`}
                style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                onDragOver={(e) => onSlotDragOver(e, slot)}
                onDragLeave={onSlotDragLeave}
                onDrop={(e) => onSlotDrop(e, slot)}
              >
                {/* Slot content when no block covers it */}
                {!blockLayout.some(({ startIdx, span }) => idx >= startIdx && idx < startIdx + span) && (
                  <div className={`h-full flex items-center px-2 rounded-sm transition-colors ${
                    isPreview ? 'border border-katsu-accent/30 border-dashed' : ''
                  }`}>
                    <span className="text-xs text-katsu-text-dim opacity-0 hover:opacity-30 select-none">—</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Blocks — absolutely positioned, height based on duration */}
          {blockLayout.map(({ block, startIdx, span, task, project }) => {
            const color = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#374151';
            const isDragging = draggingBlockId === block.id;
            const blockHeight = span * SLOT_HEIGHT;
            const startSlot = block.startTime.split('T')[1]?.substring(0, 5) || '00:00';
            const endSlot = block.endTime.split('T')[1]?.substring(0, 5) || '00:30';

            return (
              <div
                key={block.id}
                className={`absolute w-full z-10 px-0.5 group transition-opacity ${isDragging ? 'opacity-30' : ''}`}
                style={{ top: startIdx * SLOT_HEIGHT + 1, height: blockHeight - 2 }}
                draggable
                onDragStart={(e) => onBlockDragStart(e, block.id)}
                onDragEnd={onDragEnd}
              >
                <div
                  className={`h-full rounded flex flex-col px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden ${
                    block.status === 'done' ? 'opacity-60' : ''
                  }`}
                  style={{ backgroundColor: color + '18', borderLeft: `3px solid ${color}` }}
                >
                  {/* Block header */}
                  <div className="flex items-start justify-between gap-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-katsu-text font-medium truncate">
                        {task ? task.name : block.label || block.blockType}
                      </div>
                      {project && <div className="text-katsu-text-dim truncate" style={{ fontSize: '10px' }}>{project.name}</div>}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <GripVertical size={10} className="text-katsu-text-dim" />
                    </div>
                  </div>

                  {/* Time range */}
                  <div className="text-katsu-text-dim mt-auto" style={{ fontSize: '10px' }}>
                    {formatTimeSlot(startSlot)} – {formatTimeSlot(endSlot)}
                    {task?.durationEstimate && <span className="ml-1">({formatMinutes(task.durationEstimate)})</span>}
                  </div>

                  {/* Status actions — shown on larger blocks or on hover */}
                  {blockHeight >= 48 && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {block.status === 'done' ? (
                        <button onClick={(e) => { e.stopPropagation(); onBlockStatus(block.id, 'assigned'); }}
                          className="text-xs text-green-400 flex items-center gap-0.5 hover:bg-green-400/10 rounded px-1">
                          <Check size={10} />Done
                        </button>
                      ) : block.status === 'skipped' ? (
                        <button onClick={(e) => { e.stopPropagation(); onBlockStatus(block.id, 'assigned'); }}
                          className="text-xs text-katsu-text-dim flex items-center gap-0.5 hover:bg-katsu-surface-3 rounded px-1">
                          <SkipForward size={10} />Skipped
                        </button>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); onBlockStatus(block.id, 'done'); }}
                            className="p-0.5 text-green-400 hover:bg-green-400/10 rounded" title="Done">
                            <Check size={11} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onBlockStatus(block.id, 'skipped'); }}
                            className="p-0.5 text-katsu-text-dim hover:bg-katsu-surface-3 rounded" title="Skip">
                            <SkipForward size={11} />
                          </button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }}
                        className="p-0.5 text-red-400 hover:bg-red-400/10 rounded ml-auto" title="Remove">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}

                  {/* Compact actions for single-slot blocks */}
                  {blockHeight < 48 && (
                    <div className="absolute top-0.5 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {block.status !== 'done' && block.status !== 'skipped' && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); onBlockStatus(block.id, 'done'); }}
                            className="p-0.5 text-green-400 hover:bg-green-400/10 rounded" title="Done">
                            <Check size={10} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onBlockStatus(block.id, 'skipped'); }}
                            className="p-0.5 text-katsu-text-dim hover:bg-katsu-surface-3 rounded" title="Skip">
                            <SkipForward size={10} />
                          </button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }}
                        className="p-0.5 text-red-400 hover:bg-red-400/10 rounded" title="Remove">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getBlockSpanForId(
  blockId: string,
  layout: Array<{ block: TimeBlock; startIdx: number; span: number }>,
): number {
  const entry = layout.find(l => l.block.id === blockId);
  return entry?.span || 1;
}
