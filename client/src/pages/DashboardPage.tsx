import { useState, useEffect } from 'react';
import { projectsApi, analyticsApi } from '../api/client';
import { Project, AnalyticsOverview, PROJECT_TYPE_NAMES } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { formatMinutes } from '../utils/time';
import { FolderKanban, CheckCircle, Clock, Flame, Timer, TrendingUp } from 'lucide-react';

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filterStatus, filterType]);

  const loadData = async () => {
    try {
      const [projectList, analyticsData] = await Promise.all([
        projectsApi.list({ status: filterStatus, type: filterType !== 'all' ? filterType : undefined }),
        analyticsApi.overview(),
      ]);
      setProjects(projectList);
      setOverview(analyticsData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group by type
  const grouped = projects.reduce<Record<string, Project[]>>((acc, p) => {
    const type = p.projectType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-katsu-text-dim">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-bold text-katsu-text mb-4">Dashboard</h1>

      {/* Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={FolderKanban} label="Active Projects" value={overview.activeProjects} />
          <StatCard icon={CheckCircle} label="Completed This Week" value={overview.completedThisWeek} />
          <StatCard icon={TrendingUp} label="On-Time Rate" value={`${overview.onTimeCompletionRate}%`} />
          <StatCard icon={Flame} label="Streak" value={`${overview.streak} days`} />
          <StatCard icon={Timer} label="Focus Time" value={formatMinutes(overview.totalFocusMinutes)} />
          <StatCard icon={Clock} label="Block Completion" value={`${overview.blockCompletionRate}%`} />
          <StatCard icon={CheckCircle} label="Tasks Done" value={`${overview.completedTasks}/${overview.totalTasks}`} />
          <StatCard icon={TrendingUp} label="Est. Accuracy" value={`${overview.estimationAccuracy}%`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-katsu-surface border border-katsu-border rounded px-3 py-1.5 text-sm text-katsu-text"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="complete">Complete</option>
          <option value="all">All</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-katsu-surface border border-katsu-border rounded px-3 py-1.5 text-sm text-katsu-text"
        >
          <option value="all">All Types</option>
          {Object.entries(PROJECT_TYPE_NAMES).map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>
      </div>

      {/* Project Grid */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12">
          <FolderKanban size={40} className="mx-auto text-katsu-text-dim mb-3" />
          <p className="text-katsu-text-muted">No projects found</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, typeProjects]) => (
          <div key={type} className="mb-6">
            <h2 className="text-sm font-medium text-katsu-text-muted mb-2">
              {PROJECT_TYPE_NAMES[type] || type} ({typeProjects.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {typeProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="bg-katsu-surface rounded-lg border border-katsu-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-katsu-text-dim" />
        <span className="text-xs text-katsu-text-dim">{label}</span>
      </div>
      <div className="text-lg font-bold text-katsu-text">{value}</div>
    </div>
  );
}
