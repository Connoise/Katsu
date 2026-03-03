import { Router, Request, Response } from 'express';
import { db, sqlite } from '../db/index.js';
import { appSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(appSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    // Don't send password hash to client
    if (settings.app_password) {
      settings.app_password = settings.app_password ? '***' : '';
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'app_password' && value === '***') continue; // Skip unchanged password
      sqlite.prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).run(key, String(value));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/test-telegram
router.post('/test-telegram', async (_req: Request, res: Response) => {
  try {
    const tokenRow = await db.select().from(appSettings).where(eq(appSettings.key, 'telegram_bot_token'));
    const chatRow = await db.select().from(appSettings).where(eq(appSettings.key, 'telegram_chat_id'));

    const botToken = tokenRow[0]?.value;
    const chatId = chatRow[0]?.value;

    if (!botToken || !chatId) {
      return res.status(400).json({ error: 'Telegram bot token and chat ID are required' });
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ Katsu notification test successful! Your Telegram integration is working.',
        parse_mode: 'HTML',
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      return res.status(400).json({ error: result.description || 'Telegram API error' });
    }

    res.json({ success: true, message: 'Test message sent!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

export default router;
