import { useState, useEffect } from 'react';
import { Project, ProjectStatus, Priority, PROJECT_TYPE_NAMES } from '../../types';
import { X } from 'lucide-react';

interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const PROJECT_TYPES = Object.entries(PROJECT_TYPE_NAMES).map(([slug, name]) => ({ slug, name }));
const STATUSES: ProjectStatus[] = ['active', 'paused', 'complete', 'shelved', 'abandoned'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [projectType, setProjectType] = useState(project?.projectType || 'other');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'active');
  const [priority, setPriority] = useState<Priority>(project?.priority || 'medium');
  const [targetDeadline, setTargetDeadline] = useState(project?.targetDeadline?.split('T')[0] || '');
  const [tagsInput, setTagsInput] = useState((project?.tags || []).join(', '));
  const [notes, setNotes] = useState(project?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || null,
      projectType,
      status,
      priority,
      targetDeadline: targetDeadline || null,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      notes: notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-katsu-text-muted mb-1">Project Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
          placeholder="My Awesome Project"
        />
      </div>

      <div>
        <label className="block text-xs text-katsu-text-muted mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent resize-none"
          placeholder="What's this project about?"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-katsu-text-muted mb-1">Type</label>
          <select
            value={projectType}
            onChange={e => setProjectType(e.target.value)}
            className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
          >
            {PROJECT_TYPES.map(({ slug, name }) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-katsu-text-muted mb-1">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
          >
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {project && (
        <div>
          <label className="block text-xs text-katsu-text-muted mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ProjectStatus)}
            className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs text-katsu-text-muted mb-1">Target Deadline</label>
        <input
          type="date"
          value={targetDeadline}
          onChange={e => setTargetDeadline(e.target.value)}
          className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
        />
      </div>

      <div>
        <label className="block text-xs text-katsu-text-muted mb-1">Tags (comma-separated)</label>
        <input
          type="text"
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
          placeholder="tag1, tag2, tag3"
        />
      </div>

      <div>
        <label className="block text-xs text-katsu-text-muted mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent resize-none"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-katsu-accent text-black font-medium py-2 rounded text-sm hover:bg-katsu-accent-hover transition-colors"
        >
          {project ? 'Update Project' : 'Create Project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-katsu-border rounded text-sm text-katsu-text-muted hover:bg-katsu-surface-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
