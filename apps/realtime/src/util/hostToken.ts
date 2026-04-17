import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Signe `{ roomCode, playerId }` avec un HMAC-SHA256 pour prouver que ce joueur
 * est bien l'hôte lors d'une reconnexion.
 */
export function signHostToken(roomCode: string, playerId: string): string {
  const payload = `${roomCode}:${playerId}`;
  const mac = crypto
    .createHmac('sha256', config.hostSecret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${mac}`;
}

export function verifyHostToken(token: string, roomCode: string, playerId: string): boolean {
  try {
    const [payload, mac] = token.split('.');
    if (!payload || !mac) return false;
    if (payload !== `${roomCode}:${playerId}`) return false;
    const expected = crypto
      .createHmac('sha256', config.hostSecret)
      .update(payload)
      .digest('base64url');
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}
