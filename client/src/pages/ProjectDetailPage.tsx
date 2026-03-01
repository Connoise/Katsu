import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsApi, analyticsApi } from '../api/client';
import { Project, ProjectAnalytics, PROJECT_TYPE_COLORS, PROJECT_TYPE_NAMES, PRIORITY_COLORS } from '../types';
import { ProjectForm } from '../components/projects/ProjectForm';
import { TaskList } from '../components/tasks/TaskList';
import { formatMinutes, formatDate, relativeTime } from '../utils/time';
import { ArrowLeft, Pencil, Trash2, Archive, Timer, TrendingUp, Clock, Target, X } from 'lucide-react';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProject = async () => {
    if (!id) return;
    try {
      const [projectData, analyticsData] = await Promise.all([
        projectsApi.get(id),
        analyticsApi.project(id),
      ]);
      setProject(projectData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [id]);

  const handleUpdate = async (data: any) => {
    if (!id) return;
    await projectsApi.update(id, data);
    setEditing(false);
    loadProject();
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this project? This cannot be undone.')) return;
    await projectsApi.delete(id);
    navigate('/projects');
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-katsu-text-dim">{loading ? 'Loading...' : 'Project not found'}</div>
      </div>
    );
  }

  const color = PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF';
  const typeName = PROJECT_TYPE_NAMES[project.projectType] || project.projectType;

  const paceEmoji = analytics?.pace === 'ahead' ? '🟢' : analytics?.pace === 'behind' ? '🔴' : '🟡';
  const paceLabel = analytics?.pace === 'ahead' ? 'Ahead' : analytics?.pace === 'behind' ? 'Behind' : 'On Track';

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-katsu-text-muted hover:text-katsu-text mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Project Header */}
      <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-katsu-text-dim">{typeName}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: PRIORITY_COLORS[project.priority] + '20', color: PRIORITY_COLORS[project.priority] }}
              >
                {project.priority}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-katsu-surface-3 text-katsu-text-dim capitalize">
                {project.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-katsu-text">{project.name}</h1>
            {project.description && <p className="text-sm text-katsu-text-muted mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setEditing(!editing)} className="p-2 text-katsu-text-dim hover:text-katsu-text hover:bg-katsu-surface-2 rounded">
              {editing ? <X size={16} /> : <Pencil size={16} />}
            </button>
            <button onClick={handleDelete} className="p-2 text-red-400 hover:bg-red-400/10 rounded">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-katsu-text-muted">
              {project.completedTasks || 0}/{project.totalTasks || 0} tasks
            </span>
            <span className="text-katsu-text-muted">{project.completionPercent || 0}%</span>
          </div>
          <div className="w-full h-2 bg-katsu-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${project.completionPercent || 0}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Quick stats */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-katsu-surface-2 rounded p-2">
              <div className="text-katsu-text-dim flex items-center gap-1"><Clock size={10} /> Estimated</div>
              <div className="text-katsu-text font-medium">{formatMinutes(analytics.totalEstimatedMinutes)}</div>
            </div>
            <div className="bg-katsu-surface-2 rounded p-2">
              <div className="text-katsu-text-dim flex items-center gap-1"><Timer size={10} /> Actual</div>
              <div className="text-katsu-text font-medium">{formatMinutes(analytics.totalActualMinutes)}</div>
            </div>
            <div className="bg-katsu-surface-2 rounded p-2">
              <div className="text-katsu-text-dim flex items-center gap-1"><Target size={10} /> Blocks</div>
              <div className="text-katsu-text font-medium">{analytics.doneBlocks}/{analytics.totalBlocks}</div>
            </div>
            <div className="bg-katsu-surface-2 rounded p-2">
              <div className="text-katsu-text-dim flex items-center gap-1"><TrendingUp size={10} /> Pace</div>
              <div className="text-katsu-text font-medium">{paceEmoji} {paceLabel}</div>
            </div>
          </div>
        )}

        {project.targetDeadline && (
          <div className="text-xs text-katsu-text-dim mt-2">
            Deadline: {formatDate(project.targetDeadline.split('T')[0])}
          </div>
        )}

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.tags.map((tag) => (
              <span key={tag} className="text-xs bg-katsu-surface-3 text-katsu-text-dim px-2 py-0.5 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4 mb-4">
          <h2 className="text-sm font-medium text-katsu-text mb-3">Edit Project</h2>
          <ProjectForm project={project} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </div>
      )}

      {/* Tasks */}
      <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
        <h2 className="text-sm font-medium text-katsu-text mb-3">Tasks</h2>
        <TaskList
          tasks={project.tasks || []}
          projectId={project.id}
          onUpdate={loadProject}
          onStartFocus={(task) => navigate(`/focus?taskId=${task.id}&projectId=${project.id}`)}
        />
      </div>
    </div>
  );
}
