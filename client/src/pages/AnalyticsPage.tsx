import { useState, useEffect } from 'react';
import { analyticsApi } from '../api/client';
import { AnalyticsOverview } from '../types';
import { formatMinutes } from '../utils/time';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import {
  FolderKanban, CheckCircle, Clock, Flame, Timer,
  TrendingUp, Target, SkipForward, BarChart3
} from 'lucide-react';

export function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [overviewData, weeklyData] = await Promise.all([
        analyticsApi.overview(),
        analyticsApi.weekly(),
      ]);
      setOverview(overviewData);
      setWeekly(weeklyData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !overview) {
    return <div className="flex items-center justify-center h-64"><div className="text-katsu-text-dim">Loading...</div></div>;
  }

  const pieData = [
    { name: 'Completed', value: overview.doneBlocks, color: '#10B981' },
    { name: 'Skipped', value: overview.skippedBlocks, color: '#9CA3AF' },
    { name: 'Remaining', value: Math.max(0, overview.totalBlocks - overview.doneBlocks - overview.skippedBlocks), color: '#374151' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-bold text-katsu-text mb-4">Analytics</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={FolderKanban} label="Active Projects" value={overview.activeProjects} />
        <StatCard icon={CheckCircle} label="Tasks Completed" value={`${overview.completedTasks}/${overview.totalTasks}`} />
        <StatCard icon={TrendingUp} label="This Week" value={overview.completedThisWeek} />
        <StatCard icon={Flame} label="Streak" value={`${overview.streak} days`} />
        <StatCard icon={Timer} label="Focus Time" value={formatMinutes(overview.totalFocusMinutes)} />
        <StatCard icon={Target} label="On-Time Start" value={`${overview.onTimeStartRate}%`} />
        <StatCard icon={CheckCircle} label="On-Time Complete" value={`${overview.onTimeCompletionRate}%`} />
        <StatCard icon={BarChart3} label="Block Completion" value={`${overview.blockCompletionRate}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Time Invested */}
        <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <h2 className="text-sm font-medium text-katsu-text mb-3">Time Investment</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-katsu-text-muted mb-1">
                <span>Estimated</span>
                <span>{formatMinutes(overview.totalEstimatedMinutes)}</span>
              </div>
              <div className="w-full h-2 bg-katsu-surface-3 rounded-full">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-katsu-text-muted mb-1">
                <span>Actual</span>
                <span>{formatMinutes(overview.totalActualMinutes)}</span>
              </div>
              <div className="w-full h-2 bg-katsu-surface-3 rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, overview.estimationAccuracy)}%`,
                    backgroundColor: overview.estimationAccuracy > 110 ? '#EF4444' : overview.estimationAccuracy >= 90 ? '#10B981' : '#F59E0B',
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-katsu-text-dim text-center">
              Estimation Accuracy: {overview.estimationAccuracy}%
            </div>
          </div>
        </div>

        {/* Block Distribution */}
        <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <h2 className="text-sm font-medium text-katsu-text mb-3">Block Distribution</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#999' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-katsu-text-dim text-sm">No block data yet</div>
          )}
          <div className="flex justify-center gap-4 text-xs text-katsu-text-dim mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
        <h2 className="text-sm font-medium text-katsu-text mb-3">Tasks Completed (Weekly)</h2>
        {weekly.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="week"
                tick={{ fill: '#999', fontSize: 10 }}
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis tick={{ fill: '#999', fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#999' }}
              />
              <Bar dataKey="completed" fill="#FACC15" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-katsu-text-dim text-sm">No weekly data yet</div>
        )}
      </div>
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
