import { useState, useEffect } from 'react';
import { scheduleTemplatesApi } from '../api/client';
import { DayType, BlockType } from '../types';
import { formatTimeSlot, generateFullDaySlots, getToday } from '../utils/time';
import { Plus, Layout, Trash2, Play, X, Clock, Coffee, Wrench, Layers } from 'lucide-react';

const DAY_TYPE_LABELS: Record<DayType, string> = {
  workday: 'Workday',
  weekend: 'Weekend',
  day_off: 'Day Off',
  show_day: 'Show Day',
};

const BLOCK_TYPE_CONFIG: Record<BlockType, { label: string; color: string; icon: any }> = {
  task: { label: 'Task', color: '#3B82F6', icon: Wrench },
  fixed: { label: 'Fixed', color: '#FACC15', icon: Clock },
  break: { label: 'Break', color: '#10B981', icon: Coffee },
  buffer: { label: 'Buffer', color: '#9CA3AF', icon: Layers },
};

interface TemplateBlock {
  label: string;
  blockType: BlockType;
  startTime: string;
  endTime: string;
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState(getToday());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDayType, setNewDayType] = useState<DayType>('workday');
  const [newBlocks, setNewBlocks] = useState<TemplateBlock[]>([]);
  const [addBlockLabel, setAddBlockLabel] = useState('');
  const [addBlockType, setAddBlockType] = useState<BlockType>('fixed');
  const [addBlockStart, setAddBlockStart] = useState('09:00');
  const [addBlockEnd, setAddBlockEnd] = useState('09:30');

  const allSlots = generateFullDaySlots();

  const loadTemplates = async () => {
    try {
      const data = await scheduleTemplatesApi.list();
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
    if (!newName.trim() || newBlocks.length === 0) return;
    await scheduleTemplatesApi.create({
      name: newName.trim(),
      description: newDesc.trim() || null,
      dayType: newDayType,
      blocks: newBlocks,
    });
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    setNewDayType('workday');
    setNewBlocks([]);
    loadTemplates();
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingId || !applyDate) return;
    await scheduleTemplatesApi.apply(applyingId, { date: applyDate });
    setApplyingId(null);
    setApplyDate(getToday());
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await scheduleTemplatesApi.delete(id);
    loadTemplates();
  };

  const addBlock = () => {
    if (!addBlockLabel.trim()) return;
    setNewBlocks(prev => [...prev, {
      label: addBlockLabel.trim(),
      blockType: addBlockType,
      startTime: addBlockStart,
      endTime: addBlockEnd,
    }].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setAddBlockLabel('');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-katsu-text-dim">Loading...</div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-katsu-text">Day Templates</h1>
          <p className="text-xs text-katsu-text-dim">Create schedule templates and apply them to any day</p>
        </div>
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
            <h2 className="text-sm font-medium text-katsu-text">New Day Template</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-katsu-text-dim hover:text-katsu-text"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)} required
              placeholder="Template name (e.g. Weekday Studio)"
              className="col-span-2 bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
            />
            <select value={newDayType} onChange={e => setNewDayType(e.target.value as DayType)}
              className="bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text">
              {Object.entries(DAY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text focus:outline-none focus:border-katsu-accent"
            />
          </div>

          {/* Blocks list */}
          <div>
            <label className="block text-xs text-katsu-text-muted mb-1">Time Blocks</label>
            {newBlocks.length === 0 && (
              <p className="text-xs text-katsu-text-dim mb-2">Add time blocks to define this day's schedule</p>
            )}
            {newBlocks.map((b, i) => {
              const config = BLOCK_TYPE_CONFIG[b.blockType];
              return (
                <div key={i} className="flex items-center gap-2 text-sm text-katsu-text mb-1 rounded px-2 py-1"
                  style={{ backgroundColor: config.color + '10', borderLeft: `3px solid ${config.color}` }}>
                  <span className="text-xs font-mono text-katsu-text-dim w-28">
                    {formatTimeSlot(b.startTime)} – {formatTimeSlot(b.endTime)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: config.color }}>{config.label}</span>
                  <span className="flex-1 text-xs">{b.label}</span>
                  <button type="button" onClick={() => setNewBlocks(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                    <X size={12} />
                  </button>
                </div>
              );
            })}

            {/* Add block row */}
            <div className="flex gap-2 mt-2 items-end flex-wrap">
              <div>
                <label className="block text-xs text-katsu-text-dim mb-0.5">Start</label>
                <select value={addBlockStart} onChange={e => setAddBlockStart(e.target.value)}
                  className="bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text">
                  {allSlots.map(s => <option key={s} value={s}>{formatTimeSlot(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-katsu-text-dim mb-0.5">End</label>
                <select value={addBlockEnd} onChange={e => setAddBlockEnd(e.target.value)}
                  className="bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text">
                  {allSlots.map(s => <option key={s} value={s}>{formatTimeSlot(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-katsu-text-dim mb-0.5">Type</label>
                <select value={addBlockType} onChange={e => setAddBlockType(e.target.value as BlockType)}
                  className="bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text">
                  {Object.entries(BLOCK_TYPE_CONFIG).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-katsu-text-dim mb-0.5">Label</label>
                <input type="text" value={addBlockLabel} onChange={e => setAddBlockLabel(e.target.value)}
                  placeholder="e.g. Morning Production"
                  className="w-full bg-katsu-surface border border-katsu-border rounded px-2 py-1 text-xs text-katsu-text focus:outline-none focus:border-katsu-accent" />
              </div>
              <button type="button" onClick={addBlock}
                className="text-xs px-3 py-1 bg-katsu-surface-3 rounded text-katsu-text-muted hover:text-katsu-text">Add</button>
            </div>
          </div>

          <button type="submit" disabled={newBlocks.length === 0}
            className="text-sm px-4 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover disabled:opacity-50">
            Create Template
          </button>
        </form>
      )}

      {/* Apply modal */}
      {applyingId && (
        <form onSubmit={handleApply} className="bg-katsu-surface rounded-lg border border-katsu-accent p-4 mb-4 space-y-3">
          <h2 className="text-sm font-medium text-katsu-text">Apply Template to Day</h2>
          <p className="text-xs text-katsu-text-dim">This will create time blocks on the selected date. Existing blocks on that day will not be removed.</p>
          <input type="date" value={applyDate} onChange={e => setApplyDate(e.target.value)} required
            className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text" />
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-4 py-1.5 bg-katsu-accent text-black rounded font-medium hover:bg-katsu-accent-hover">Apply</button>
            <button type="button" onClick={() => setApplyingId(null)} className="text-sm px-4 py-1.5 text-katsu-text-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-12">
          <Layout size={40} className="mx-auto text-katsu-text-dim mb-3" />
          <p className="text-katsu-text-muted">No day templates yet</p>
          <p className="text-xs text-katsu-text-dim mt-1">Create a template to quickly fill a day's schedule</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tmpl => {
            const isExpanded = expandedId === tmpl.id;
            const blockCount = tmpl.blocks?.length || 0;

            return (
              <div key={tmpl.id} className="bg-katsu-surface rounded-lg border border-katsu-border">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-katsu-surface-3 text-katsu-text-dim capitalize">
                          {DAY_TYPE_LABELS[tmpl.dayType as DayType] || tmpl.dayType}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-katsu-text">{tmpl.name}</h3>
                      {tmpl.description && <p className="text-xs text-katsu-text-dim mt-0.5">{tmpl.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setApplyingId(tmpl.id)} className="p-1.5 text-katsu-accent hover:bg-katsu-accent/10 rounded" title="Apply to a day">
                        <Play size={14} />
                      </button>
                      <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-katsu-text-dim">
                    {blockCount} block{blockCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Expanded block list */}
                {isExpanded && tmpl.blocks && tmpl.blocks.length > 0 && (
                  <div className="border-t border-katsu-border px-4 py-3 space-y-1">
                    {tmpl.blocks.map((block: any, i: number) => {
                      const config = BLOCK_TYPE_CONFIG[block.blockType as BlockType] || BLOCK_TYPE_CONFIG.fixed;
                      return (
                        <div key={block.id || i} className="flex items-center gap-2 rounded px-2 py-1"
                          style={{ backgroundColor: config.color + '10', borderLeft: `3px solid ${config.color}` }}>
                          <span className="text-xs font-mono text-katsu-text-dim w-28">
                            {formatTimeSlot(block.startTime)} – {formatTimeSlot(block.endTime)}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: config.color }}>{config.label}</span>
                          <span className="flex-1 text-xs text-katsu-text">{block.label}</span>
                        </div>
                      );
                    })}
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
