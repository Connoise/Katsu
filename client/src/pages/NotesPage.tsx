import { useState, useEffect } from 'react';
import { sessionNotesApi, projectsApi, tasksApi } from '../api/client';
import { SessionNote, Project, Task, NoteType, PROJECT_TYPE_COLORS } from '../types';
import { relativeTime } from '../utils/time';
import { Plus, Filter, BookOpen, Lightbulb, AlertTriangle, CheckCircle, MessageSquare, X } from 'lucide-react';

const NOTE_TYPE_CONFIG: Record<NoteType, { icon: any; label: string; color: string }> = {
  idea: { icon: Lightbulb, label: 'Idea', color: '#FACC15' },
  decision: { icon: CheckCircle, label: 'Decision', color: '#3B82F6' },
  blocker: { icon: AlertTriangle, label: 'Blocker', color: '#EF4444' },
  progress: { icon: CheckCircle, label: 'Progress', color: '#10B981' },
  general: { icon: MessageSquare, label: 'General', color: '#9CA3AF' },
};

export function NotesPage() {
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<NoteType>('general');
  const [newProjectId, setNewProjectId] = useState('');
  const [newTaskId, setNewTaskId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterType !== 'all') params.noteType = filterType;
      if (filterProject !== 'all') params.projectId = filterProject;

      const [noteList, projectList, taskList] = await Promise.all([
        sessionNotesApi.list(Object.keys(params).length > 0 ? params : undefined),
        projectsApi.list({ status: 'active' }),
        tasksApi.list(),
      ]);
      setNotes(noteList);
      setProjects(projectList);
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterType, filterProject]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !newProjectId) return;

    await sessionNotesApi.create({
      projectId: newProjectId,
      taskId: newTaskId || null,
      content: newContent.trim(),
      noteType: newType,
    });
    setNewContent('');
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await sessionNotesApi.delete(id);
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-katsu-text-dim">Loading...</div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-katsu-text">Session Notes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover"
        >
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-katsu-surface border border-katsu-border rounded px-3 py-1.5 text-sm text-katsu-text"
        >
          <option value="all">All Types</option>
          {Object.entries(NOTE_TYPE_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="bg-katsu-surface border border-katsu-border rounded px-3 py-1.5 text-sm text-katsu-text"
        >
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* New Note Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-katsu-surface rounded-lg border border-katsu-border p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-katsu-text">New Note</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-katsu-text-dim hover:text-katsu-text"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)} required className="bg-katsu-surface-2 border border-katsu-border rounded px-2 py-1.5 text-sm text-katsu-text">
              <option value="">Project *</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={newTaskId} onChange={e => setNewTaskId(e.target.value)} className="bg-katsu-surface-2 border border-katsu-border rounded px-2 py-1.5 text-sm text-katsu-text">
              <option value="">Task (optional)</option>
              {tasks.filter(t => !newProjectId || t.projectId === newProjectId).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            {Object.entries(NOTE_TYPE_CONFIG).map(([key, { label, color }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setNewType(key as NoteType)}
                className={`text-xs px-2 py-1 rounded border ${newType === key ? 'border-current' : 'border-katsu-border text-katsu-text-dim'}`}
                style={newType === key ? { color, borderColor: color } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            required
            placeholder="Write your note... (supports markdown)"
            className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent resize-none"
          />
          <button type="submit" className="text-sm px-4 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover">Save Note</button>
        </form>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="mx-auto text-katsu-text-dim mb-3" />
          <p className="text-katsu-text-muted">No notes yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => {
            const config = NOTE_TYPE_CONFIG[note.noteType];
            const Icon = config.icon;
            const project = projects.find(p => p.id === note.projectId);
            const task = note.taskId ? tasks.find(t => t.id === note.taskId) : null;
            const projectColor = project ? (PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF') : '#9CA3AF';

            return (
              <div key={note.id} className="bg-katsu-surface rounded-lg border border-katsu-border p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color: config.color }} />
                    <span className="text-xs" style={{ color: config.color }}>{config.label}</span>
                    <span className="text-xs text-katsu-text-dim">{relativeTime(note.createdAt)}</span>
                  </div>
                  <button onClick={() => handleDelete(note.id)} className="text-xs text-katsu-text-dim hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
                <p className="text-sm text-katsu-text whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  {project && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: projectColor + '20', color: projectColor }}>
                      {project.name}
                    </span>
                  )}
                  {task && <span className="text-xs text-katsu-text-dim">{task.name}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
