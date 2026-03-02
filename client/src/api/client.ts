const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('katsu_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ─── Project Types ──────────────────────────────────────────────
export const projectTypesApi = {
  list: () => request<any[]>('/project-types'),
  create: (data: { name: string; slug: string; color: string }) =>
    request<any>('/project-types', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Projects ───────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: { status?: string; type?: string; priority?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<any[]>(`/projects${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<any>(`/projects/${id}`),
  create: (data: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/projects/${id}`, { method: 'DELETE' }),
};

// ─── Tasks ──────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: { projectId?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<any[]>(`/tasks${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<any>(`/tasks/${id}`),
  create: (data: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/tasks/${id}`, { method: 'DELETE' }),
};

// ─── Time Blocks ────────────────────────────────────────────────
export const timeBlocksApi = {
  list: (params?: { scheduleDayId?: string; taskId?: string; date?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<any[]>(`/time-blocks${qs ? `?${qs}` : ''}`);
  },
  create: (data: any) => request<any>('/time-blocks', { method: 'POST', body: JSON.stringify(data) }),
  createBulk: (data: any) => request<any[]>('/time-blocks/bulk', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/time-blocks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/time-blocks/${id}`, { method: 'DELETE' }),
};

// ─── Schedule Days ──────────────────────────────────────────────
export const schedulesApi = {
  getDays: (params?: { from?: string; to?: string; date?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<any>(`/schedules/days${qs ? `?${qs}` : ''}`);
  },
  getDay: (id: string) => request<any>(`/schedules/days/${id}`),
  createDay: (data: any) => request<any>('/schedules/days', { method: 'POST', body: JSON.stringify(data) }),
  updateDay: (id: string, data: any) => request<any>(`/schedules/days/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDay: (id: string) => request<any>(`/schedules/days/${id}`, { method: 'DELETE' }),
  // Schedule Entries
  getEntries: () => request<any[]>('/schedules/entries'),
  createEntry: (data: any) => request<any>('/schedules/entries', { method: 'POST', body: JSON.stringify(data) }),
  updateEntry: (id: string, data: any) => request<any>(`/schedules/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntry: (id: string) => request<any>(`/schedules/entries/${id}`, { method: 'DELETE' }),
};

// ─── Focus Sessions ─────────────────────────────────────────────
export const focusSessionsApi = {
  list: (params?: { taskId?: string; projectId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<any[]>(`/focus-sessions${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<any>(`/focus-sessions/${id}`),
  create: (data: any) => request<any>('/focus-sessions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/focus-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  pause: (id: string) => request<any>(`/focus-sessions/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => request<any>(`/focus-sessions/${id}/resume`, { method: 'POST' }),
};

// ─── Session Notes ──────────────────────────────────────────────
export const sessionNotesApi = {
  list: (params?: { projectId?: string; taskId?: string; focusSessionId?: string; noteType?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<any[]>(`/session-notes${qs ? `?${qs}` : ''}`);
  },
  create: (data: any) => request<any>('/session-notes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/session-notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/session-notes/${id}`, { method: 'DELETE' }),
};

// ─── Analytics ──────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => request<any>('/analytics/overview'),
  project: (id: string) => request<any>(`/analytics/project/${id}`),
  weekly: () => request<any[]>('/analytics/weekly'),
};

// ─── Templates ──────────────────────────────────────────────────
export const templatesApi = {
  list: () => request<any[]>('/templates'),
  get: (id: string) => request<any>(`/templates/${id}`),
  create: (data: any) => request<any>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  instantiate: (id: string, data: any) => request<any>(`/templates/${id}/instantiate`, { method: 'POST', body: JSON.stringify(data) }),
  fromProject: (projectId: string, data: any) => request<any>(`/templates/from-project/${projectId}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/templates/${id}`, { method: 'DELETE' }),
};

// ─── Schedule Templates (day schedule templates) ────────────────
export const scheduleTemplatesApi = {
  list: () => request<any[]>('/schedule-templates'),
  get: (id: string) => request<any>(`/schedule-templates/${id}`),
  create: (data: any) => request<any>('/schedule-templates', { method: 'POST', body: JSON.stringify(data) }),
  apply: (id: string, data: { date: string }) => request<any>(`/schedule-templates/${id}/apply`, { method: 'POST', body: JSON.stringify(data) }),
  fromDay: (dayId: string, data: { name: string }) => request<any>(`/schedule-templates/from-day/${dayId}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/schedule-templates/${id}`, { method: 'DELETE' }),
};

// ─── Archive ────────────────────────────────────────────────────
export const archiveApi = {
  list: () => request<any[]>('/archive'),
  archive: (projectId: string, data: { reason: string; notes?: string }) =>
    request<any>(`/archive/${projectId}`, { method: 'POST', body: JSON.stringify(data) }),
  reopen: (id: string) => request<any>(`/archive/${id}/reopen`, { method: 'POST' }),
};
