export function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatTimeSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

export function getWeekDates(offset = 0): string[] {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function generateFullDaySlots(): string[] {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += 30) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

export function generateTimeSlots(start: string, end: string): string[] {
  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60;

  const slots: string[] = [];
  for (let m = startMin; m < endMin; m += 30) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

export function slotSpan(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(Math.ceil((end - start) / 30), 1);
}

export function addMinutesToSlot(slot: string, minutes: number): string {
  const total = timeToMinutes(slot) + minutes;
  return minutesToTime(total % (24 * 60));
}

export function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return formatDateShort(dateStr.split('T')[0]);
}
