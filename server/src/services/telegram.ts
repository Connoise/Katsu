import { db } from '../db/index.js';
import { appSettings, timeBlocks, tasks, projects, scheduleDays } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

async function getSetting(key: string): Promise<string> {
  const row = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row[0]?.value || '';
}

async function sendTelegramMessage(text: string): Promise<boolean> {
  const botToken = await getSetting('telegram_bot_token');
  const chatId = await getSetting('telegram_chat_id');
  const dnd = await getSetting('do_not_disturb');

  if (!botToken || !chatId) return false;
  if (dnd === 'true') return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    return result.ok;
  } catch {
    return false;
  }
}

// Check for upcoming blocks and send notifications
async function checkNotifications() {
  const notifyStart = await getSetting('notify_block_start');
  const notifyOverdue = await getSetting('notify_block_overdue');

  if (notifyStart !== 'true' && notifyOverdue !== 'true') return;

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Get today's schedule
  const dayResult = await db.select().from(scheduleDays).where(eq(scheduleDays.date, today));
  if (dayResult.length === 0) return;

  const dayBlocks = await db.select().from(timeBlocks)
    .where(eq(timeBlocks.scheduleDayId, dayResult[0].id));

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const block of dayBlocks) {
    // Only notify for task blocks (not breaks/fixed/buffer)
    if (block.blockType !== 'task') continue;
    if (block.status === 'done' || block.status === 'skipped') continue;

    const blockStartStr = block.startTime.split('T')[1]?.substring(0, 5) || '00:00';
    const [bh, bm] = blockStartStr.split(':').map(Number);
    const blockStartMinutes = bh * 60 + bm;

    // 5-minute warning
    if (notifyStart === 'true') {
      const diff = blockStartMinutes - currentMinutes;
      if (diff >= 4 && diff <= 5) {
        const task = block.taskId
          ? (await db.select().from(tasks).where(eq(tasks.id, block.taskId)))[0]
          : null;
        const label = task ? task.name : (block.label || 'Task');
        const timeStr = formatTimeAMPM(blockStartStr);
        await sendTelegramMessage(`⏰ <b>Starting in 5 minutes:</b> ${label} at ${timeStr}`);
      }
    }

    // Overdue (5 minutes past start, still not done)
    if (notifyOverdue === 'true') {
      const diff = currentMinutes - blockStartMinutes;
      if (diff >= 5 && diff <= 6 && block.status === 'assigned') {
        const task = block.taskId
          ? (await db.select().from(tasks).where(eq(tasks.id, block.taskId)))[0]
          : null;
        const label = task ? task.name : (block.label || 'Task');
        const timeStr = formatTimeAMPM(blockStartStr);
        await sendTelegramMessage(`⚠️ <b>Overdue:</b> ${label} was scheduled for ${timeStr}`);
      }
    }
  }
}

function formatTimeAMPM(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Start the notification checker — runs every minute
export function startNotificationService() {
  console.log('Notification service started (checking every 60s)');
  setInterval(() => {
    checkNotifications().catch(err => {
      console.error('Notification check error:', err);
    });
  }, 60 * 1000);
}
