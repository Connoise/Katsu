import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { focusSessionsApi, tasksApi, projectsApi, sessionNotesApi } from '../api/client';
import { Task, Project, FocusSession, FocusMode, PROJECT_TYPE_COLORS } from '../types';
import { formatMinutes } from '../utils/time';
import { Timer, Pause, Play, Square, Plus, Clock } from 'lucide-react';

export function FocusPage() {
  const [searchParams] = useSearchParams();
  const taskIdParam = searchParams.get('taskId');
  const projectIdParam = searchParams.get('projectId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(taskIdParam || '');
  const [mode, setMode] = useState<FocusMode>('free');
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const loadData = async () => {
    const [taskList, projectList, sessions] = await Promise.all([
      tasksApi.list(),
      projectsApi.list({ status: 'active' }),
      focusSessionsApi.list(),
    ]);
    setTasks(taskList);
    setProjects(projectList);
    setRecentSessions(sessions.slice(0, 10));

    // Check for active session
    const active = sessions.find((s: FocusSession) => s.status === 'active' || s.status === 'paused');
    if (active) {
      setActiveSession(active);
      setSelectedTaskId(active.taskId);
      setIsPaused(active.status === 'paused');
      const startTime = new Date(active.startedAt).getTime();
      const pauseTime = active.pauses.reduce((sum: number, p: any) => {
        if (p.resumedAt) return sum + (new Date(p.resumedAt).getTime() - new Date(p.pausedAt).getTime());
        return sum + (Date.now() - new Date(p.pausedAt).getTime());
      }, 0);
      setElapsed(Math.floor((Date.now() - startTime - pauseTime) / 1000));
      if (active.status === 'active') startTimer();
    }
  };

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  }, []);

  const handleStart = async () => {
    if (!selectedTaskId) return;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    const session = await focusSessionsApi.create({
      taskId: selectedTaskId,
      projectId: task.projectId,
      mode,
      targetDuration: mode === 'pomodoro' ? 25 : null,
    });
    setActiveSession(session);
    setElapsed(0);
    setIsPaused(false);
    startTimer();
  };

  const handlePause = async () => {
    if (!activeSession) return;
    await focusSessionsApi.pause(activeSession.id);
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleResume = async () => {
    if (!activeSession) return;
    await focusSessionsApi.resume(activeSession.id);
    setIsPaused(false);
    startTimer();
  };

  const handleStop = async () => {
    if (!activeSession) return;
    if (timerRef.current) clearInterval(timerRef.current);

    await focusSessionsApi.update(activeSession.id, {
      status: 'completed',
      endedAt: new Date().toISOString(),
      actualDuration: Math.floor(elapsed / 60),
    });
    setActiveSession(null);
    setElapsed(0);
    setIsPaused(false);
    loadData();
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !activeSession) return;
    const task = tasks.find(t => t.id === activeSession.taskId);
    await sessionNotesApi.create({
      projectId: activeSession.projectId,
      taskId: activeSession.taskId,
      focusSessionId: activeSession.id,
      content: noteText.trim(),
      noteType: 'progress',
    });
    setNoteText('');
  };

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const selectedProject = selectedTask ? projects.find(p => p.id === selectedTask.projectId) : null;
  const color = selectedProject ? (PROJECT_TYPE_COLORS[selectedProject.projectType] || '#9CA3AF') : '#FACC15';

  return (
    <div className="max-w-xl mx-auto p-4 md:p-6">
      <h1 className="text-lg font-bold text-katsu-text mb-6">Focus Session</h1>

      {/* Active Session */}
      {activeSession ? (
        <div className="text-center mb-8">
          <div className="mb-2">
            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: color + '20', color }}>
              {selectedProject?.name}
            </span>
          </div>
          <h2 className="text-sm text-katsu-text-muted mb-4">{selectedTask?.name}</h2>

          <div className="text-6xl font-mono font-bold text-katsu-text mb-6" style={{ color }}>
            {formatTimer(elapsed)}
          </div>

          <div className="flex justify-center gap-3 mb-6">
            {isPaused ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-6 py-3 bg-katsu-accent text-black rounded-lg font-medium hover:bg-katsu-accent-hover"
              >
                <Play size={18} /> Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 bg-katsu-surface-2 border border-katsu-border text-katsu-text rounded-lg hover:bg-katsu-surface-3"
              >
                <Pause size={18} /> Pause
              </button>
            )}
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20"
            >
              <Square size={18} /> Stop
            </button>
          </div>

          {/* Quick note */}
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              placeholder="Quick note..."
              className="flex-1 bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
            />
            <button
              onClick={handleAddNote}
              disabled={!noteText.trim()}
              className="px-3 py-2 bg-katsu-surface-2 border border-katsu-border rounded text-katsu-text-muted hover:text-katsu-text disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Session Setup */
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs text-katsu-text-muted mb-1">Task</label>
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
            >
              <option value="">Select a task...</option>
              {tasks.filter(t => t.status !== 'complete').map(task => {
                const project = projects.find(p => p.id === task.projectId);
                return (
                  <option key={task.id} value={task.id}>
                    {project ? `${project.name}: ` : ''}{task.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs text-katsu-text-muted mb-1">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('free')}
                className={`flex-1 py-2 rounded border text-sm ${mode === 'free' ? 'border-katsu-accent text-katsu-accent bg-katsu-accent/5' : 'border-katsu-border text-katsu-text-muted'}`}
              >
                Free Timer
              </button>
              <button
                onClick={() => setMode('pomodoro')}
                className={`flex-1 py-2 rounded border text-sm ${mode === 'pomodoro' ? 'border-katsu-accent text-katsu-accent bg-katsu-accent/5' : 'border-katsu-border text-katsu-text-muted'}`}
              >
                Pomodoro
              </button>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!selectedTaskId}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-katsu-accent text-black rounded-lg font-medium hover:bg-katsu-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Timer size={18} /> Start Focus Session
          </button>
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-katsu-text-muted mb-2">Recent Sessions</h2>
          <div className="space-y-1">
            {recentSessions.filter(s => s.status === 'completed').map(session => {
              const task = tasks.find(t => t.id === session.taskId);
              const project = projects.find(p => p.id === session.projectId);
              const color = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#9CA3AF';

              return (
                <div key={session.id} className="flex items-center gap-3 bg-katsu-surface rounded border border-katsu-border px-3 py-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-katsu-text truncate">{task?.name || 'Unknown task'}</div>
                    <div className="text-xs text-katsu-text-dim">{project?.name}</div>
                  </div>
                  <div className="text-xs text-katsu-text-muted flex items-center gap-1">
                    <Clock size={10} />
                    {session.actualDuration ? formatMinutes(session.actualDuration) : '--'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
