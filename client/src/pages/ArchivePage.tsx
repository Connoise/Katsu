import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { archiveApi } from '../api/client';
import { PROJECT_TYPE_COLORS, PROJECT_TYPE_NAMES } from '../types';
import { formatMinutes, relativeTime } from '../utils/time';
import { Archive, RotateCcw } from 'lucide-react';

export function ArchivePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadRecords = async () => {
    try {
      const data = await archiveApi.list();
      setRecords(data);
    } catch (err) {
      console.error('Failed to load archive:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const handleReopen = async (id: string) => {
    const result = await archiveApi.reopen(id);
    navigate(`/projects/${result.projectId}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-katsu-text-dim">Loading...</div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <h1 className="text-lg font-bold text-katsu-text mb-4">Archive</h1>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <Archive size={40} className="mx-auto text-katsu-text-dim mb-3" />
          <p className="text-katsu-text-muted">No archived projects</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(record => {
            const project = record.snapshot?.project;
            if (!project) return null;
            const color = PROJECT_TYPE_COLORS[project.project_type || project.projectType] || '#9CA3AF';
            const analytics = record.snapshot?.analytics;

            return (
              <div key={record.id} className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs capitalize px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '20', color }}>
                        {record.reason}
                      </span>
                      <span className="text-xs text-katsu-text-dim">{relativeTime(record.archivedAt)}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-katsu-text">{project.name}</h3>
                    {record.notes && <p className="text-xs text-katsu-text-dim mt-0.5">{record.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleReopen(record.id)}
                    className="flex items-center gap-1 text-xs px-2 py-1 text-katsu-accent hover:bg-katsu-accent/10 rounded"
                  >
                    <RotateCcw size={12} /> Reopen
                  </button>
                </div>
                {analytics && (
                  <div className="flex gap-4 text-xs text-katsu-text-dim">
                    <span>Completion: {analytics.completionRate}%</span>
                    <span>On-Time: {analytics.onTimeRate}%</span>
                    <span>Est: {formatMinutes(analytics.totalEstimatedMinutes)}</span>
                    <span>Actual: {formatMinutes(analytics.totalActualMinutes)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
