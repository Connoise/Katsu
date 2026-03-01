import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesApi } from '../api/client';
import { PROJECT_TYPE_COLORS, PROJECT_TYPE_NAMES } from '../types';
import { formatMinutes } from '../utils/time';
import { Plus, Layout, Trash2, Play, X } from 'lucide-react';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [instantiating, setInstantiating] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('other');
  const [newTasks, setNewTasks] = useState<Array<{ name: string; durationEstimate: number; order: number }>>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('60');

  const loadTemplates = async () => {
    try {
      const data = await templatesApi.list();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await templatesApi.create({
      name: newName,
      description: newDesc || null,
      projectType: newType,
      tasks: newTasks,
    });
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    setNewTasks([]);
    loadTemplates();
  };

  const handleInstantiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instantiating || !projectName) return;
    const project = await templatesApi.instantiate(instantiating, {
      projectName,
      targetDeadline: targetDeadline || null,
    });
    setInstantiating(null);
    setProjectName('');
    setTargetDeadline('');
    navigate(`/projects/${project.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await templatesApi.delete(id);
    loadTemplates();
  };

  const addTaskToTemplate = () => {
    if (!newTaskName.trim()) return;
    setNewTasks(prev => [...prev, {
      name: newTaskName.trim(),
      durationEstimate: parseInt(newTaskDuration) || 60,
      order: prev.length,
    }]);
    setNewTaskName('');
    setNewTaskDuration('60');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-katsu-text-dim">Loading...</div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-katsu-text">Templates</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-katsu-surface rounded-lg border border-katsu-border p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-katsu-text">New Template</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-katsu-text-dim hover:text-katsu-text"><X size={16} /></button>
          </div>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Template name" className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent" />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" rows={2} className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent resize-none" />
          <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text">
            {Object.entries(PROJECT_TYPE_NAMES).map(([slug, name]) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
          </select>

          {/* Template Tasks */}
          <div>
            <label className="block text-xs text-katsu-text-muted mb-1">Tasks</label>
            {newTasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-katsu-text mb-1">
                <span className="text-xs text-katsu-text-dim w-6">{i + 1}.</span>
                <span className="flex-1">{t.name}</span>
                <span className="text-xs text-katsu-text-dim">{formatMinutes(t.durationEstimate)}</span>
                <button type="button" onClick={() => setNewTasks(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                  <X size={12} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-1">
              <input type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="Task name" className="flex-1 bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text" />
              <input type="number" value={newTaskDuration} onChange={e => setNewTaskDuration(e.target.value)} placeholder="Min" className="w-16 bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text" />
              <button type="button" onClick={addTaskToTemplate} className="text-xs px-2 py-1 bg-katsu-surface-3 rounded text-katsu-text-muted hover:text-katsu-text">Add</button>
            </div>
          </div>

          <button type="submit" className="text-sm px-4 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover">Create Template</button>
        </form>
      )}

      {/* Instantiate Modal */}
      {instantiating && (
        <form onSubmit={handleInstantiate} className="bg-katsu-surface rounded-lg border border-katsu-accent p-4 mb-4 space-y-3">
          <h2 className="text-sm font-medium text-katsu-text">Create Project from Template</h2>
          <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} required placeholder="Project name" className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent" />
          <input type="date" value={targetDeadline} onChange={e => setTargetDeadline(e.target.value)} className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text" />
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-4 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover">Create Project</button>
            <button type="button" onClick={() => setInstantiating(null)} className="text-sm px-4 py-1.5 text-katsu-text-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-12">
          <Layout size={40} className="mx-auto text-katsu-text-dim mb-3" />
          <p className="text-katsu-text-muted">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tmpl => {
            const color = PROJECT_TYPE_COLORS[tmpl.projectType] || '#9CA3AF';
            return (
              <div key={tmpl.id} className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-katsu-text-dim">{PROJECT_TYPE_NAMES[tmpl.projectType] || tmpl.projectType}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-katsu-text">{tmpl.name}</h3>
                    {tmpl.description && <p className="text-xs text-katsu-text-dim mt-0.5">{tmpl.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setInstantiating(tmpl.id)} className="p-1.5 text-katsu-accent hover:bg-katsu-accent/10 rounded" title="Use template">
                      <Play size={14} />
                    </button>
                    <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-katsu-text-dim">
                  {tmpl.tasks?.length || 0} tasks · {tmpl.totalEstimatedHrs}h estimated
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
