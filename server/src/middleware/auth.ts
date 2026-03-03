import { Request, Response, NextFunction } from 'express';
import { sqlite } from '../db/index.js';
import crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Login endpoint is always accessible
  if (req.path === '/auth/login') return next();
  // Export endpoints need auth but are handled normally
  // Settings endpoints need auth but are handled normally

  // Check if a password is configured in app_settings
  let storedPassword = '';
  try {
    const row = sqlite.prepare('SELECT value FROM app_settings WHERE key = ?').get('app_password') as { value: string } | undefined;
    storedPassword = row?.value || '';
  } catch {
    // Table might not exist yet during init
  }

  // Also support legacy AUTH_TOKEN env var
  const envToken = process.env.AUTH_TOKEN;

  // If no password and no env token, skip auth
  if (!storedPassword && !envToken) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Check against stored password hash
  if (storedPassword && token === storedPassword) return next();
  // Check against env token
  if (envToken && token === envToken) return next();

  return res.status(401).json({ error: 'Unauthorized' });
}

export function loginHandler(req: Request, res: Response) {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  let storedPassword = '';
  try {
    const row = sqlite.prepare('SELECT value FROM app_settings WHERE key = ?').get('app_password') as { value: string } | undefined;
    storedPassword = row?.value || '';
  } catch {
    return res.status(500).json({ error: 'Settings not initialized' });
  }

  if (!storedPassword) {
    return res.status(400).json({ error: 'No password has been set. Configure one in Settings.' });
  }

  const hashed = hashPassword(password);
  if (hashed === storedPassword) {
    return res.json({ token: storedPassword });
  }

  return res.status(401).json({ error: 'Invalid password' });
}

export function setPasswordHandler(req: Request, res: Response) {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const hashed = hashPassword(password);
  try {
    sqlite.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('app_password', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(hashed);
    return res.json({ success: true, token: hashed });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set password' });
  }
}
