import { nanoid } from 'nanoid';
import { randomAvatar, randomNickname } from './avatars';
import type { Avatar } from '@mvpc/shared';

const PLAYER_ID_KEY = 'mvpc.playerId';
const NICKNAME_KEY = 'mvpc.nickname';
const AVATAR_KEY = 'mvpc.avatar';
const HOST_TOKEN_PREFIX = 'mvpc.hostToken.';

export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const id = nanoid(12);
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

export function getNickname(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(NICKNAME_KEY) ?? '';
}
export function setNickname(nickname: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NICKNAME_KEY, nickname);
}

export function getAvatar(): Avatar {
  if (typeof window === 'undefined') return randomAvatar();
  const raw = localStorage.getItem(AVATAR_KEY);
  if (!raw) {
    const a = randomAvatar();
    localStorage.setItem(AVATAR_KEY, JSON.stringify(a));
    return a;
  }
  try {
    return JSON.parse(raw) as Avatar;
  } catch {
    return randomAvatar();
  }
}
export function setAvatar(avatar: Avatar) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AVATAR_KEY, JSON.stringify(avatar));
}

export function getDefaultNickname(): string {
  return getNickname() || randomNickname();
}

export function saveHostToken(roomCode: string, token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HOST_TOKEN_PREFIX + roomCode, token);
}
export function loadHostToken(roomCode: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(HOST_TOKEN_PREFIX + roomCode) ?? undefined;
}
