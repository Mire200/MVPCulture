'use client';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mvpc/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (typeof window === 'undefined') {
    throw new Error('getSocket() called on server');
  }
  if (socket && socket.connected) return socket;
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';
    socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    }) as AppSocket;
  }
  return socket;
}
