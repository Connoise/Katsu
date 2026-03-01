import { Link } from 'react-router-dom';
import { Project, PROJECT_TYPE_COLORS, PROJECT_TYPE_NAMES, PRIORITY_COLORS } from '../../types';
import { formatMinutes } from '../../utils/time';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const color = PROJECT_TYPE_COLORS[project.projectType] || '#9CA3AF';
  const typeName = PROJECT_TYPE_NAMES[project.projectType] || project.projectType;
  const completionPercent = project.completionPercent || 0;

  const paceStatus = () => {
    if (!project.totalEstimatedMinutes || project.totalEstimatedMinutes === 0) return null;
    const ratio = (project.totalActualMinutes || 0) / project.totalEstimatedMinutes;
    if (ratio >= 0.9 && ratio <= 1.1) return { label: 'On Track', emoji: '🟢' };
    if (ratio > 1.1) return { label: 'Ahead', emoji: '🟢' };
    return { label: 'Behind', emoji: project.totalActualMinutes! > 0 ? '🟡' : '🔴' };
  };

  const pace = paceStatus();

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-katsu-surface rounded-lg border border-katsu-border hover:border-katsu-border-light transition-colors p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs text-katsu-text-dim">{typeName}</span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: PRIORITY_COLORS[project.priority] + '20', color: PRIORITY_COLORS[project.priority] }}
        >
          {project.priority}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-katsu-text mb-1 truncate">{project.name}</h3>
      {project.description && (
        <p className="text-xs text-katsu-text-dim mb-3 line-clamp-2">{project.description}</p>
      )}

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-katsu-text-muted">
            {project.completedTasks || 0}/{project.totalTasks || 0} tasks
          </span>
          <span className="text-katsu-text-muted">{completionPercent}%</span>
        </div>
        <div className="w-full h-1.5 bg-katsu-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${completionPercent}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-katsu-text-dim">
        <span>
          {project.totalActualMinutes ? formatMinutes(project.totalActualMinutes) : '0m'}
          {project.totalEstimatedMinutes ? ` / ${formatMinutes(project.totalEstimatedMinutes)}` : ''}
        </span>
        {pace && <span>{pace.emoji} {pace.label}</span>}
      </div>

      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {project.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-katsu-surface-3 text-katsu-text-dim px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
