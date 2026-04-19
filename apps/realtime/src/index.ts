import http from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  AnswerPayloadSchema,
  CreateRoomPayloadSchema,
  ERROR_CODES,
  GuessWhoPickSecretPayloadSchema,
  GuessWhoToggleMaskPayloadSchema,
  JoinRoomPayloadSchema,
  LobbyDrawStrokePayloadSchema,
  StartGamePayloadSchema,
  ValidatePayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@mvpc/shared';
import { config } from './config.js';
import { RoomManager } from './rooms/RoomManager.js';
import { Room } from './rooms/Room.js';
import { signHostToken, verifyHostToken } from './util/hostToken.js';
import { hitRateLimit } from './util/rateLimit.js';
import { Radio } from './radio/Radio.js';

type SockData = { roomCode?: string; playerId?: string };

const manager = new RoomManager();

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: manager.all().length }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SockData>(
  httpServer,
  {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 20_000,
  },
);

const radio = new Radio();
radio.start();
radio.onChange((state) => {
  io.emit('radio:state', state);
});

function broadcastRoom(room: Room) {
  io.to(room.code).emit('room:state', room.snapshot());
}

function emitGwMasksToPlayer(room: Room, playerId: string) {
  if (!room.round || room.round.mode !== 'guess-who') return;
  const socketId = room.socketsByPlayer.get(playerId);
  if (!socketId) return;
  const byTarget = room.gwMasksSnapshot(playerId);
  io.to(socketId).emit('guessWho:masks', { byTarget });
}

function emitLobbyDrawingSync(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SockData>,
  room: Room,
) {
  socket.emit('lobby:drawing:sync', { strokes: room.lobbyDrawing });
}

function emitError(socket: ReturnType<Server['sockets']['sockets']['get']> | any, code: string, message: string) {
  socket?.emit('error', { code, message });
}

async function maybeAutoReveal(room: Room) {
  if (room.shouldAutoReveal()) {
    room.goToReveal();
    if (room.round?.reveal) {
      io.to(room.code).emit('round:reveal', room.round.reveal);
    }
    broadcastRoom(room);
  }
}

// Tick loop for rounds that use timers (list-turns especially).
setInterval(() => {
  for (const room of manager.all()) {
    if (room.phase !== 'round_collect') continue;
    const events = room.tick();
    for (const ev of events) {
      if (ev.type === 'eliminated') {
        io.to(room.code).emit('round:eliminated', { playerId: ev.playerId, reason: ev.reason });
      } else if (ev.type === 'turn_started') {
        io.to(room.code).emit('round:turn_started', {
          currentPlayerId: ev.currentPlayerId,
          endsAt: ev.endsAt,
        });
      }
    }
    // `room.tick()` peut avoir fait passer la phase en 'round_reveal'.
    if ((room.phase as string) === 'round_reveal' && room.round?.reveal) {
      io.to(room.code).emit('round:reveal', room.round.reveal);
      broadcastRoom(room);
      continue;
    }
    // Timeout côté parallel (classic, estimation).
    if (room.round && room.round.collect.kind === 'parallel') {
      if (Date.now() >= room.round.collect.endsAt) {
        room.goToReveal();
        if (room.round.reveal) io.to(room.code).emit('round:reveal', room.round.reveal);
        broadcastRoom(room);
      }
    }
  }
}, 500);

io.on('connection', (socket) => {
  socket.data = {};

  socket.on('room:create', (payload, ack) => {
    const parsed = CreateRoomPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const ip = socket.handshake.address || 'unknown';
    if (hitRateLimit(`create:${ip}`, 5, 60_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de salons créés' });
    }
    const room = manager.create();
    const player = Room.newPlayer({
      nickname: parsed.data.nickname,
      avatar: parsed.data.avatar,
      isHost: true,
    });
    room.addPlayer(player);
    room.hostId = player.id;
    room.socketsByPlayer.set(player.id, socket.id);
    socket.data = { roomCode: room.code, playerId: player.id };
    socket.join(room.code);

    const hostToken = signHostToken(room.code, player.id);
    ack({
      ok: true,
      data: {
        code: room.code,
        playerId: player.id,
        hostToken,
        snapshot: room.snapshot(),
      },
    });
    emitLobbyDrawingSync(socket, room);
    broadcastRoom(room);
  });

  socket.on('room:join', (payload, ack) => {
    const parsed = JoinRoomPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const room = manager.get(parsed.data.code);
    if (!room) {
      return ack({ ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: 'Salon introuvable' });
    }
    if (room.phase !== 'lobby' && room.phase !== 'match_final') {
      return ack({
        ok: false,
        code: ERROR_CODES.ROOM_ALREADY_STARTED,
        message: 'Partie déjà commencée',
      });
    }
    if (room.players.size >= 12) {
      return ack({ ok: false, code: ERROR_CODES.ROOM_FULL, message: 'Salon plein' });
    }
    const player = Room.newPlayer({
      nickname: parsed.data.nickname,
      avatar: parsed.data.avatar,
      isHost: false,
    });
    try {
      room.addPlayer(player);
    } catch (e) {
      return ack({ ok: false, code: ERROR_CODES.ROOM_FULL, message: 'Salon plein' });
    }
    room.socketsByPlayer.set(player.id, socket.id);
    socket.data = { roomCode: room.code, playerId: player.id };
    socket.join(room.code);
    ack({
      ok: true,
      data: { code: room.code, playerId: player.id, snapshot: room.snapshot() },
    });
    if (room.phase === 'lobby') emitLobbyDrawingSync(socket, room);
    io.to(room.code).emit('room:player_joined', player);
    broadcastRoom(room);
  });

  socket.on('room:resume', (payload, ack) => {
    const room = manager.get(payload.code);
    if (!room) return ack({ ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: 'Introuvable' });
    const player = room.players.get(payload.playerId);
    if (!player) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Plus dans ce salon' });
    }
    room.setPlayerConnected(payload.playerId, true);
    room.socketsByPlayer.set(payload.playerId, socket.id);
    socket.data = { roomCode: room.code, playerId: payload.playerId };
    socket.join(room.code);
    const hostToken =
      payload.hostToken && verifyHostToken(payload.hostToken, room.code, payload.playerId)
        ? payload.hostToken
        : undefined;
    ack({
      ok: true,
      data: { code: room.code, playerId: payload.playerId, hostToken, snapshot: room.snapshot() },
    });
    if (room.phase === 'lobby') emitLobbyDrawingSync(socket, room);
    broadcastRoom(room);
    if (room.round?.mode === 'guess-who') {
      emitGwMasksToPlayer(room, payload.playerId);
    }
  });

  socket.on('room:leave', () => {
    leave(socket);
  });

  socket.on('game:start', (payload, ack) => {
    const parsed = StartGamePayloadSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.hostId !== playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_HOST, message: 'Seul l’hôte peut lancer' });
    }
    try {
      room.startGame(parsed.data.config);
    } catch (e) {
      return ack({
        ok: false,
        code: ERROR_CODES.ROOM_ALREADY_STARTED,
        message: 'Partie déjà commencée',
      });
    }
    io.to(room.code).emit('lobby:draw:cleared');
    ack({ ok: true, data: null });
    io.to(room.code).emit('round:started', room.snapshot());
    broadcastRoom(room);
  });

  socket.on('round:answer', (payload, ack) => {
    const parsed = AnswerPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`answer:${playerId}`, 30, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de réponses' });
    }
    try {
      const events = room.submitAnswer(playerId, parsed.data);
      ack({ ok: true, data: null });
      for (const ev of events) {
        if (ev.type === 'player_answered') {
          io.to(room.code).emit('round:player_answered', { playerId: ev.playerId });
        } else if (ev.type === 'eliminated') {
          io.to(room.code).emit('round:eliminated', {
            playerId: ev.playerId,
            reason: ev.reason,
          });
        } else if (ev.type === 'turn_started') {
          io.to(room.code).emit('round:turn_started', {
            currentPlayerId: ev.currentPlayerId,
            endsAt: ev.endsAt,
          });
        }
      }
      maybeAutoReveal(room);
      broadcastRoom(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('round:validate', (payload, ack) => {
    const parsed = ValidatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.hostId !== playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_HOST, message: 'Seul l’hôte peut valider' });
    }
    if (room.phase !== 'round_reveal') {
      return ack({
        ok: false,
        code: ERROR_CODES.PHASE_MISMATCH,
        message: 'Phase incorrecte',
      });
    }
    room.applyHostValidations(parsed.data.validations);
    io.to(room.code).emit('round:validated', { validations: parsed.data.validations });
    ack({ ok: true, data: null });
  });

  socket.on('round:advance', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.hostId !== playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_HOST, message: 'Seul l’hôte peut avancer' });
    }
    if (room.phase === 'round_reveal') {
      // compute scoring using host validations
      const validations = room.round
        ? Object.entries(room.round.hostValidations).map(([pid, correct]) => ({
            playerId: pid,
            correct,
          }))
        : undefined;
      const scoring = room.computeAndApplyScoring(validations);
      io.to(room.code).emit('round:scored', scoring);
      broadcastRoom(room);
      ack({ ok: true, data: null });
      return;
    }
    if (room.phase === 'round_score') {
      room.nextRound();
      if ((room.phase as string) === 'match_final') {
        io.to(room.code).emit('match:final', { standings: room.standings() });
      } else {
        io.to(room.code).emit('round:started', room.snapshot());
      }
      broadcastRoom(room);
      ack({ ok: true, data: null });
      return;
    }
    ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Phase incorrecte' });
  });

  socket.on('match:rematch', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.hostId !== playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_HOST, message: 'Seul l’hôte peut relancer' });
    }
    if (room.phase !== 'match_final') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Partie non terminée' });
    }
    room.phase = 'lobby';
    room.roundIndex = -1;
    room.round = undefined;
    for (const p of room.players.values()) p.score = 0;
    room.clearLobbyDrawing();
    io.to(room.code).emit('lobby:draw:cleared');
    broadcastRoom(room);
    ack({ ok: true, data: null });
  });

  socket.on('guessWho:pickSecret', (payload, ack) => {
    const parsed = GuessWhoPickSecretPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      room.gwPickSecret(playerId, parsed.data.avatarSrc);
      ack({ ok: true, data: null });
      broadcastRoom(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('guessWho:toggleMask', (payload, ack) => {
    const parsed = GuessWhoToggleMaskPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`gwmask:${playerId}`, 120, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de masques' });
    }
    try {
      room.gwToggleMask(
        playerId,
        parsed.data.targetId,
        parsed.data.avatarSrc,
        parsed.data.masked,
      );
      ack({ ok: true, data: null });
      emitGwMasksToPlayer(room, playerId);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('guessWho:nextTurn', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      room.gwNextTurn(playerId);
      ack({ ok: true, data: null });
      broadcastRoom(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('guessWho:selfEliminate', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      const { revealedAvatar, completed } = room.gwSelfEliminate(playerId);
      io.to(room.code).emit('guessWho:playerEliminated', {
        playerId,
        revealedAvatar,
      });
      if (completed) {
        room.goToReveal();
        if (room.round?.reveal) io.to(room.code).emit('round:reveal', room.round.reveal);
      }
      broadcastRoom(room);
      ack({ ok: true, data: null });
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('lobby:draw:stroke', (payload, ack) => {
    const parsed = LobbyDrawStrokePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.phase !== 'lobby') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Pas en attente' });
    }
    /* Segments 2 points en continu : fenêtre 1s (≈90/s max par joueur). */
    if (hitRateLimit(`lobbydraw:${playerId}`, 90, 1000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de traits' });
    }
    const stroke = room.appendLobbyStroke(playerId, parsed.data);
    io.to(room.code).emit('lobby:draw:stroke', stroke);
    ack({ ok: true, data: null });
  });

  socket.on('lobby:draw:clear', (...args: unknown[]) => {
    const ack = args.find((a) => typeof a === 'function') as ((res: unknown) => void) | undefined;
    if (!ack) return;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.phase !== 'lobby') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Pas en attente' });
    }
    if (room.hostId !== playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_HOST, message: 'Seul l’hôte peut effacer' });
    }
    room.clearLobbyDrawing();
    io.to(room.code).emit('lobby:draw:cleared');
    ack({ ok: true, data: null });
  });

  socket.on('lobby:drawing:request', (...args: unknown[]) => {
    const ack = args.find((a) => typeof a === 'function') as ((res: unknown) => void) | undefined;
    if (!ack) return;
    const { room } = socketRoom(socket);
    if (!room) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    ack({ ok: true, data: { strokes: room.lobbyDrawing } });
  });

  socket.on('radio:sync', (...args: unknown[]) => {
    const ack = args[args.length - 1] as (res: unknown) => void;
    if (typeof ack !== 'function') return;
    ack({ ok: true, data: radio.getState() });
  });

  socket.on('radio:skip', (...args: unknown[]) => {
    const ack = args[args.length - 1] as (res: unknown) => void;
    if (typeof ack !== 'function') return;
    if (hitRateLimit(`radio:skip:${socket.id}`, 3, 10_000)) {
      return ack({
        ok: false,
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Doucement sur le zapping',
      });
    }
    const state = radio.skip();
    ack({ ok: true, data: state });
  });

  // Push l'état courant aux nouveaux arrivants pour qu'ils se synchronisent.
  socket.emit('radio:state', radio.getState());

  socket.on('disconnect', () => {
    leave(socket);
  });
});

function socketRoom(socket: { data: SockData }): { room?: Room; playerId?: string } {
  const { roomCode, playerId } = socket.data;
  if (!roomCode || !playerId) return {};
  const room = manager.get(roomCode);
  if (!room) return {};
  return { room, playerId };
}

function leave(socket: { data: SockData; leave: (room: string) => void; id: string }) {
  const { roomCode, playerId } = socket.data;
  if (!roomCode || !playerId) return;
  const room = manager.get(roomCode);
  if (!room) return;
  // Marque comme déconnecté plutôt que supprimer (permet la reconnexion si en partie).
  if (room.phase === 'lobby') {
    room.removePlayer(playerId);
    if (room.players.size === 0) {
      manager.delete(room.code);
      return;
    }
    if (room.hostId === playerId) room.reassignHost();
    io.to(room.code).emit('room:player_left', playerId);
    broadcastRoom(room);
  } else {
    room.setPlayerConnected(playerId, false);
    if (room.hostId === playerId && !room.activePlayers().some((p) => p.id === playerId)) {
      room.reassignHost();
    }
    broadcastRoom(room);
  }
  socket.data.roomCode = undefined;
  socket.data.playerId = undefined;
  socket.leave(roomCode);
}

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[realtime] Socket.IO server listening on :${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`[realtime] CORS origin: ${config.corsOrigin.join(', ')}`);
});
