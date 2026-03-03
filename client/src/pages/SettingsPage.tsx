import { useState, useEffect } from 'react';
import { archiveApi } from '../api/client';
import { PROJECT_TYPE_COLORS } from '../types';
import { relativeTime } from '../utils/time';
import {
  Settings, Shield, Bell, Database, Archive, Info,
  Download, Send, RotateCcw,
} from 'lucide-react';

interface SettingsData {
  passwordSet: boolean;
  telegram: {
    botToken: string;
    chatId: string;
  };
  notifications: {
    doNotDisturb: boolean;
    blockStarting: boolean;
    blockOverdue: boolean;
    focusReminders: boolean;
  };
}

const defaultSettings: SettingsData = {
  passwordSet: false,
  telegram: { botToken: '', chatId: '' },
  notifications: {
    doNotDisturb: false,
    blockStarting: true,
    blockOverdue: true,
    focusReminders: true,
  },
};

const BASE_URL = '/api';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('katsu_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Telegram test
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');

  // Archive
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  // Export
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadArchive();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${BASE_URL}/settings`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Map flat key-value response to structured SettingsData
        setSettings({
          passwordSet: data.app_password === '***',
          telegram: {
            botToken: data.telegram_bot_token || '',
            chatId: data.telegram_chat_id || '',
          },
          notifications: {
            doNotDisturb: data.do_not_disturb === 'true',
            blockStarting: data.notify_block_start !== 'false',
            blockOverdue: data.notify_block_overdue !== 'false',
            focusReminders: data.notify_focus_reminder !== 'false',
          },
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadArchive = async () => {
    try {
      const data = await archiveApi.list();
      setArchiveRecords(data);
    } catch (err) {
      console.error('Failed to load archive:', err);
    } finally {
      setArchiveLoading(false);
    }
  };

  // Convert structured SettingsData to flat key-value pairs for the server
  const toFlatSettings = (s: SettingsData) => ({
    telegram_bot_token: s.telegram.botToken,
    telegram_chat_id: s.telegram.chatId,
    do_not_disturb: String(s.notifications.doNotDisturb),
    notify_block_start: String(s.notifications.blockStarting),
    notify_block_overdue: String(s.notifications.blockOverdue),
    notify_focus_reminder: String(s.notifications.focusReminders),
  });

  const saveSettings = async (updated: SettingsData) => {
    setSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch(`${BASE_URL}/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(toFlatSettings(updated)),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveMessage('Settings saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (err) {
      setSaveMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword.trim()) return;
    setPasswordMessage('');
    try {
      const res = await fetch(`${BASE_URL}/auth/set-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error('Failed to update password');
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('katsu_auth_token', data.token);
      }
      setNewPassword('');
      setPasswordMessage('Password updated');
      setSettings(prev => ({ ...prev, passwordSet: true }));
      setTimeout(() => setPasswordMessage(''), 2000);
    } catch (err) {
      setPasswordMessage('Failed to update password');
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramMessage('');
    try {
      const res = await fetch(`${BASE_URL}/settings/test-telegram`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Test failed');
      setTelegramMessage('Test message sent!');
    } catch (err) {
      setTelegramMessage('Failed to send test message');
    } finally {
      setTestingTelegram(false);
      setTimeout(() => setTelegramMessage(''), 3000);
    }
  };

  const handleExportCsv = async (type: 'projects' | 'tasks' | 'time-blocks') => {
    setExporting(type);
    try {
      const res = await fetch(`${BASE_URL}/export/${type}?format=csv`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `katsu-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to export ${type}:`, err);
    } finally {
      setExporting(null);
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await archiveApi.reopen(id);
      loadArchive();
    } catch (err) {
      console.error('Failed to reopen project:', err);
    }
  };

  const updateNotification = (key: keyof SettingsData['notifications'], value: boolean) => {
    const updated = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const updateTelegram = (key: keyof SettingsData['telegram'], value: string) => {
    setSettings(prev => ({
      ...prev,
      telegram: { ...prev.telegram, [key]: value },
    }));
  };

  const saveTelegram = () => {
    saveSettings(settings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-katsu-text-dim">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-katsu-accent" />
        <h1 className="text-lg font-bold text-katsu-text">Settings</h1>
        {saveMessage && (
          <span className={`ml-auto text-xs ${saveMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
            {saveMessage}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* ─── Account Security ──────────────────────────────── */}
        <section className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-katsu-text-dim" />
            <h2 className="text-sm font-medium text-katsu-text">Account Security</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-katsu-text-muted">Auth status:</span>
              <span className={settings.passwordSet ? 'text-green-400' : 'text-katsu-text-dim'}>
                {settings.passwordSet ? 'Password set' : 'No password set'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={settings.passwordSet ? 'Change password...' : 'Set a password...'}
                className="flex-1 bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text placeholder:text-katsu-text-dim focus:outline-none focus:border-katsu-accent"
              />
              <button
                onClick={handleSetPassword}
                disabled={!newPassword.trim()}
                className="px-4 py-2 bg-katsu-accent text-black text-sm font-medium rounded hover:bg-katsu-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settings.passwordSet ? 'Change' : 'Set'}
              </button>
            </div>
            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                {passwordMessage}
              </p>
            )}
          </div>
        </section>

        {/* ─── Notifications ─────────────────────────────────── */}
        <section className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-katsu-text-dim" />
            <h2 className="text-sm font-medium text-katsu-text">Notifications</h2>
          </div>

          <div className="space-y-4">
            {/* Telegram Configuration */}
            <div>
              <h3 className="text-xs font-medium text-katsu-text-muted mb-2">Telegram Bot</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={settings.telegram.botToken}
                  onChange={e => updateTelegram('botToken', e.target.value)}
                  onBlur={saveTelegram}
                  placeholder="Bot token"
                  className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text placeholder:text-katsu-text-dim focus:outline-none focus:border-katsu-accent"
                />
                <input
                  type="text"
                  value={settings.telegram.chatId}
                  onChange={e => updateTelegram('chatId', e.target.value)}
                  onBlur={saveTelegram}
                  placeholder="Chat ID"
                  className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2 text-sm text-katsu-text placeholder:text-katsu-text-dim focus:outline-none focus:border-katsu-accent"
                />
                <button
                  onClick={handleTestTelegram}
                  disabled={testingTelegram || !settings.telegram.botToken || !settings.telegram.chatId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-katsu-surface-2 border border-katsu-border rounded text-katsu-text-muted hover:text-katsu-text hover:border-katsu-border-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={12} />
                  {testingTelegram ? 'Sending...' : 'Send Test Message'}
                </button>
                {telegramMessage && (
                  <p className={`text-xs ${telegramMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                    {telegramMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Do Not Disturb */}
            <label className="flex items-center justify-between py-2 border-t border-katsu-border">
              <span className="text-sm text-katsu-text">Do Not Disturb</span>
              <button
                onClick={() => updateNotification('doNotDisturb', !settings.notifications.doNotDisturb)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings.notifications.doNotDisturb ? 'bg-katsu-accent' : 'bg-katsu-surface-3'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.notifications.doNotDisturb ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>

            {/* Notification Types */}
            <div className="space-y-2 border-t border-katsu-border pt-3">
              <h3 className="text-xs font-medium text-katsu-text-muted mb-2">Notification Types</h3>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.blockStarting}
                  onChange={e => updateNotification('blockStarting', e.target.checked)}
                  className="w-4 h-4 rounded border-katsu-border bg-katsu-surface-2 text-katsu-accent focus:ring-katsu-accent focus:ring-offset-0"
                />
                <span className="text-sm text-katsu-text">Block starting in 5min</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.blockOverdue}
                  onChange={e => updateNotification('blockOverdue', e.target.checked)}
                  className="w-4 h-4 rounded border-katsu-border bg-katsu-surface-2 text-katsu-accent focus:ring-katsu-accent focus:ring-offset-0"
                />
                <span className="text-sm text-katsu-text">Block overdue</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.focusReminders}
                  onChange={e => updateNotification('focusReminders', e.target.checked)}
                  className="w-4 h-4 rounded border-katsu-border bg-katsu-surface-2 text-katsu-accent focus:ring-katsu-accent focus:ring-offset-0"
                />
                <span className="text-sm text-katsu-text">Focus session reminders</span>
              </label>
            </div>
          </div>
        </section>

        {/* ─── Data Export ────────────────────────────────────── */}
        <section className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-katsu-text-dim" />
            <h2 className="text-sm font-medium text-katsu-text">Data</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleExportCsv('projects')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-katsu-surface-2 border border-katsu-border rounded text-katsu-text-muted hover:text-katsu-text hover:border-katsu-border-light disabled:opacity-50"
            >
              <Download size={12} />
              {exporting === 'projects' ? 'Exporting...' : 'Export Projects'}
            </button>
            <button
              onClick={() => handleExportCsv('tasks')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-katsu-surface-2 border border-katsu-border rounded text-katsu-text-muted hover:text-katsu-text hover:border-katsu-border-light disabled:opacity-50"
            >
              <Download size={12} />
              {exporting === 'tasks' ? 'Exporting...' : 'Export Tasks'}
            </button>
            <button
              onClick={() => handleExportCsv('time-blocks')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-katsu-surface-2 border border-katsu-border rounded text-katsu-text-muted hover:text-katsu-text hover:border-katsu-border-light disabled:opacity-50"
            >
              <Download size={12} />
              {exporting === 'time-blocks' ? 'Exporting...' : 'Export Time Blocks'}
            </button>
          </div>
        </section>

        {/* ─── Archive ───────────────────────────────────────── */}
        <section className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Archive size={16} className="text-katsu-text-dim" />
            <h2 className="text-sm font-medium text-katsu-text">Archive</h2>
          </div>

          {archiveLoading ? (
            <div className="text-xs text-katsu-text-dim">Loading archive...</div>
          ) : archiveRecords.length === 0 ? (
            <div className="text-center py-8">
              <Archive size={32} className="mx-auto text-katsu-text-dim mb-2" />
              <p className="text-xs text-katsu-text-muted">No archived projects</p>
            </div>
          ) : (
            <div className="space-y-2">
              {archiveRecords.map(record => {
                const project = record.snapshot?.project;
                if (!project) return null;
                const color = PROJECT_TYPE_COLORS[project.project_type || project.projectType] || '#9CA3AF';

                return (
                  <div key={record.id} className="bg-katsu-surface-2 rounded border border-katsu-border p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
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
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── About ─────────────────────────────────────────── */}
        <section className="bg-katsu-surface rounded-lg border border-katsu-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-katsu-text-dim" />
            <h2 className="text-sm font-medium text-katsu-text">About</h2>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-katsu-accent">Katsu</span>
              <span className="text-xs text-katsu-text-dim">Creative Project Manager</span>
            </div>
            <p className="text-xs text-katsu-text-muted">Version 1.0.0</p>
          </div>
        </section>
      </div>
    </div>
  );
}
