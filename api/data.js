// Vercel serverless function for schedule data
// Stores per-room data in Vercel KV. Room ID is derived from password (SHA-256).
import { kv } from '@vercel/kv';
import crypto from 'node:crypto';

export const config = { runtime: 'nodejs' };

function roomIdFrom(password) {
  if (!password || typeof password !== 'string') return null;
  return 'room:' + crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  // CORS (same-origin so usually unnecessary, but safe)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Room-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const password = req.headers['x-room-password'];
  const roomKey = roomIdFrom(password);
  if (!roomKey) return res.status(401).json({ error: 'Missing X-Room-Password header' });

  try {
    if (req.method === 'GET') {
      const data = await kv.get(roomKey);
      return res.status(200).json({ data: data || null });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Body must be JSON object' });
      }
      await kv.set(roomKey, body);
      return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('KV error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
