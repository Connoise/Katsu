import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api/client';
import { Project, PROJECT_TYPE_NAMES } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectForm } from '../components/projects/ProjectForm';
import { Plus, X } from 'lucide-react';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list({ status: 'active' });
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (data: any) => {
    await projectsApi.create(data);
    setShowForm(false);
    loadProjects();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-katsu-text-dim">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-katsu-text">Projects</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover transition-colors"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-katsu-text">New Project</h2>
            <button onClick={() => setShowForm(false)} className="text-katsu-text-dim hover:text-katsu-text">
              <X size={16} />
            </button>
          </div>
          <ProjectForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {projects.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-katsu-text-muted mb-2">No projects yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-katsu-accent hover:underline"
          >
            Create your first project
          </button>
        </div>
      )}
    </div>
  );
}
