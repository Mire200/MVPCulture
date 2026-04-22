import http from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  AnswerPayloadSchema,
  CodenamesGuessTilePayloadSchema,
  CodenamesSetSpymasterPayloadSchema,
  CodenamesSetTeamPayloadSchema,
  CodenamesSubmitCluePayloadSchema,
  CreateRoomPayloadSchema,
  ERROR_CODES,
  GuessWhoGuessPayloadSchema,
  GuessWhoPickSecretPayloadSchema,
  GuessWhoToggleMaskPayloadSchema,
  ImposterGuessPayloadSchema,
  ImposterSubmitCluePayloadSchema,
  ImposterVotePayloadSchema,
  JoinRoomPayloadSchema,
  LobbyDrawStrokePayloadSchema,
  SetLobbyConfigPayloadSchema,
  StartGamePayloadSchema,
  ValidatePayloadSchema,
  WikiraceNavigatePayloadSchema,
  GarticPhoneSubmitTextPayloadSchema,
  GarticPhoneSubmitDrawingPayloadSchema,
  GarticPhoneAdvanceRevealPayloadSchema,
  TicketToRideClaimRoutePayloadSchema,
  TicketToRideDrawFromMarketPayloadSchema,
  TicketToRideKeepDestinationsPayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@mvpc/shared';
import { config } from './config.js';
import { RoomManager } from './rooms/RoomManager.js';
import { Room } from './rooms/Room.js';
import {
  ttrClaimRoute,
  ttrConfirmInitialDestinations,
  ttrDrawDestinations,
  ttrDrawFromDeck,
  ttrDrawFromMarket,
  ttrKeepDestinations,
  ttrPrivateFor,
} from './engine/modes/ticketToRide.js';
import { signHostToken, verifyHostToken } from './util/hostToken.js';
import { hitRateLimit } from './util/rateLimit.js';
import { Radio } from './radio/Radio.js';
import { Tv } from './tv/Tv.js';

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
    // Les navigateurs mobiles / onglets en arrière-plan throttlent agressivement
    // JS et les WebSockets (iOS suspend quand l'écran s'éteint). On laisse
    // beaucoup de marge avant de considérer un socket comme mort pour éviter
    // d'éjecter un joueur qui a juste changé d'onglet quelques dizaines de s.
    pingInterval: 25_000,
    pingTimeout: 60_000,
  },
);

const radio = new Radio();
radio.start();
radio.onChange((state) => {
  io.emit('radio:state', state);
});

const tv = new Tv();
tv.start();
tv.onChange((state) => {
  io.emit('tv:state', state);
});

function broadcastRoom(room: Room) {
  io.to(room.code).emit('room:state', room.snapshot());
}

/**
 * Éviction différée dans le lobby : quand un joueur se déconnecte avant le
 * lancement de la partie, on ne le supprime pas immédiatement (sinon un simple
 * changement d'onglet le fait disparaître). On marque comme déconnecté et on
 * programme une suppression après un délai ; si le joueur revient via
 * room:resume entre-temps on annule l'éviction.
 */
const LOBBY_GRACE_MS = 60_000;
const pendingLobbyEvictions = new Map<string, NodeJS.Timeout>();
const evictionKey = (roomCode: string, playerId: string) => `${roomCode}:${playerId}`;

function cancelLobbyEviction(roomCode: string, playerId: string) {
  const k = evictionKey(roomCode, playerId);
  const t = pendingLobbyEvictions.get(k);
  if (t) {
    clearTimeout(t);
    pendingLobbyEvictions.delete(k);
  }
}

function scheduleLobbyEviction(roomCode: string, playerId: string) {
  cancelLobbyEviction(roomCode, playerId);
  const t = setTimeout(() => {
    pendingLobbyEvictions.delete(evictionKey(roomCode, playerId));
    const room = manager.get(roomCode);
    if (!room) return;
    const p = room.players.get(playerId);
    // Si le joueur est revenu (connected=true) ou qu'on n'est plus en lobby,
    // on laisse tomber ; le cas "en jeu" est déjà géré sans éviction.
    if (!p || p.connected || (room.phase !== 'lobby' && room.phase !== 'match_final')) return;
    room.removePlayer(playerId);
    if (room.players.size === 0) {
      manager.delete(room.code);
      return;
    }
    if (room.hostId === playerId) room.reassignHost();
    io.to(room.code).emit('room:player_left', playerId);
    broadcastRoom(room);
  }, LOBBY_GRACE_MS);
  pendingLobbyEvictions.set(evictionKey(roomCode, playerId), t);
}

function emitGwMasksToPlayer(room: Room, playerId: string) {
  if (!room.round || room.round.mode !== 'guess-who') return;
  const socketId = room.socketsByPlayer.get(playerId);
  if (!socketId) return;
  const byTarget = room.gwMasksSnapshot(playerId);
  io.to(socketId).emit('guessWho:masks', { byTarget });
}

function emitImposterWordToPlayer(room: Room, playerId: string) {
  if (!room.round || room.round.mode !== 'imposter') return;
  const socketId = room.socketsByPlayer.get(playerId);
  if (!socketId) return;
  const w = room.imWordFor(playerId);
  if (!w) return;
  // On n'envoie QUE le mot : le joueur ne doit jamais savoir qu'il est
  // l'imposteur (il ne le découvre qu'au vote s'il est démasqué).
  io.to(socketId).emit('imposter:yourWord', { word: w.word });
}

function broadcastImposterWords(room: Room) {
  if (!room.round || room.round.mode !== 'imposter') return;
  for (const p of room.allPlayers()) {
    emitImposterWordToPlayer(room, p.id);
  }
}

function broadcastGarticPrompts(room: Room) {
  if (!room.round || room.round.mode !== 'gartic-phone') return;
  for (const p of room.allPlayers()) {
    const socketId = room.socketsByPlayer.get(p.id);
    if (!socketId) continue;
    const prompt = room.gpPromptFor(p.id);
    if (prompt) {
      io.to(socketId).emit('garticPhone:prompt', prompt);
    }
  }
}

function emitTtrPrivateToPlayer(room: Room, playerId: string) {
  if (!room.round || room.round.mode !== 'ticket-to-ride') return;
  if (room.round.collect.kind !== 'ticket-to-ride') return;
  const socketId = room.socketsByPlayer.get(playerId);
  if (!socketId) return;
  const payload = ttrPrivateFor(room.round.collect.ttr, playerId);
  if (!payload) return;
  io.to(socketId).emit('ttr:private', payload);
}

function broadcastTtrPrivate(room: Room) {
  if (!room.round || room.round.mode !== 'ticket-to-ride') return;
  for (const p of room.allPlayers()) emitTtrPrivateToPlayer(room, p.id);
}

function emitCodenamesKeyToPlayer(room: Room, playerId: string) {
  if (!room.round || room.round.mode !== 'codenames') return;
  const socketId = room.socketsByPlayer.get(playerId);
  if (!socketId) return;
  const payload = room.cnKeyFor(playerId);
  if (!payload) return;
  io.to(socketId).emit('codenames:key', payload);
}

function broadcastCodenamesKeys(room: Room) {
  if (!room.round || room.round.mode !== 'codenames') return;
  if (room.round.collect.kind !== 'codenames') return;
  const { red, blue } = room.round.collect.cn.spymasters;
  if (red) emitCodenamesKeyToPlayer(room, red);
  if (blue) emitCodenamesKeyToPlayer(room, blue);
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
    // list-turns et bombparty : si le tour a changé via timeout (eliminated + turn_started ou bp_explosion),
    // il faut re-broadcaster le snapshot pour que les clients voient le nouveau
    // currentPlayerId / endsAt. Sans ça, l'UI reste bloquée sur l'ancien joueur.
    if ((room.round?.mode === 'list-turns' || room.round?.mode === 'bombparty' || room.round?.mode === 'ticket-to-ride') && events.length > 0) {
      broadcastRoom(room);
      if (room.round?.mode === 'ticket-to-ride') broadcastTtrPrivate(room);
      continue;
    }
    // Timeout côté parallel (classic, estimation).
    if (room.round && room.round.collect.kind === 'parallel') {
      if (Date.now() >= room.round.collect.endsAt) {
        room.goToReveal();
        if (room.round.reveal) io.to(room.code).emit('round:reveal', room.round.reveal);
        broadcastRoom(room);
        continue;
      }
    }
    // Auto-reveal générique (ex: imposter après sub='done').
    if (room.shouldAutoReveal()) {
      room.goToReveal();
      if (room.round?.reveal) io.to(room.code).emit('round:reveal', room.round.reveal);
      broadcastRoom(room);
      continue;
    }
    // Rebroadcast si la sous-phase imposter vient de changer (timeout côté serveur).
    if (room.round?.mode === 'imposter' && room.imPhaseChangedInLastTick) {
      broadcastRoom(room);
    }
    // Rebroadcast si la sous-phase codenames (ou équipe active) a changé.
    if (room.round?.mode === 'codenames' && room.cnPhaseChangedInLastTick) {
      broadcastRoom(room);
    }
    // Rebroadcast quand hot-potato passe de bid à answer via timeout : sans ça
    // les joueurs qui n'ont pas misé restent coincés sur l'écran de mise.
    if (room.round?.mode === 'hot-potato' && room.hpPhaseChangedInLastTick) {
      broadcastRoom(room);
    }
    // Gartic Phone : rebroadcast si la sous-phase a changé (timeout).
    if (room.round?.mode === 'gartic-phone' && room.gpPhaseChangedInLastTick) {
      broadcastGarticPrompts(room);
      broadcastRoom(room);
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
    cancelLobbyEviction(room.code, payload.playerId);
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
    if (room.round?.mode === 'imposter') {
      emitImposterWordToPlayer(room, payload.playerId);
    }
    if (room.round?.mode === 'codenames') {
      emitCodenamesKeyToPlayer(room, payload.playerId);
    }
    if (room.round?.mode === 'ticket-to-ride') {
      emitTtrPrivateToPlayer(room, payload.playerId);
    }
  });

  socket.on('room:leave', () => {
    leave(socket);
  });

  socket.on('lobby:setConfig', (payload, ack) => {
    const parsed = SetLobbyConfigPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (room.hostId !== playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_HOST, message: 'Seul l’hôte peut modifier la config' });
    }
    if (hitRateLimit(`lobby:setConfig:${playerId}`, 40, 5_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de changements' });
    }
    try {
      room.setLobbyConfig(parsed.data.config);
    } catch {
      return ack({
        ok: false,
        code: ERROR_CODES.ROOM_ALREADY_STARTED,
        message: 'Configuration impossible à ce stade',
      });
    }
    ack({ ok: true, data: null });
    broadcastRoom(room);
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
      const msg = (e as Error).message;
      if (msg === 'NOT_ENOUGH_PLAYERS') {
        const cfg = parsed.data.config;
        const needsCn = cfg?.modesPool?.includes('codenames');
        return ack({
          ok: false,
          code: ERROR_CODES.INVALID_PAYLOAD,
          message: needsCn
            ? 'Il faut au moins 2 joueurs par équipe pour lancer Codenames.'
            : 'Il faut au moins 3 joueurs pour l’imposteur.',
        });
      }
      if (msg === 'TTR_PLAYER_COUNT') {
        return ack({
          ok: false,
          code: ERROR_CODES.INVALID_PAYLOAD,
          message: 'Il faut 2 à 5 joueurs pour Aventuriers du Rail.',
        });
      }
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
    if (room.round?.mode === 'imposter') broadcastImposterWords(room);
    if (room.round?.mode === 'codenames') broadcastCodenamesKeys(room);
    if (room.round?.mode === 'ticket-to-ride') broadcastTtrPrivate(room);
    // Gartic Phone : pas de prompts en phase write (le joueur invente librement).
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
      // Cherche un feedback "correct" pour le mode speed-elim, qui supporte
      // plusieurs tentatives par joueur et a besoin d'indiquer au client si
      // la dernière tentative était bonne ou non.
      const seEvent = events.find(
        (ev): ev is Extract<(typeof events)[number], { type: 'speed_elim_attempt' }> =>
          ev.type === 'speed_elim_attempt',
      );
      const bpInvalidSyl = events.find(ev => ev.type === 'bp_invalid_syllable');
      const bpUsed = events.find(ev => ev.type === 'bp_already_used');
      const bpDict = events.find(ev => ev.type === 'bp_not_in_dict');
      const bpAccepted = events.find(ev => ev.type === 'bp_word_accepted');

      if (seEvent) {
        ack({ ok: true, data: { correct: seEvent.correct } });
      } else if (bpInvalidSyl) {
        ack({ ok: true, data: { error: "Syllabe manquante" } as any });
      } else if (bpUsed) {
        ack({ ok: true, data: { error: "Mot déjà utilisé" } as any });
      } else if (bpDict) {
        ack({ ok: true, data: { error: "Mot inconnu" } as any });
      } else if (bpAccepted) {
        ack({ ok: true, data: { correct: true } });
      } else {
        ack({ ok: true, data: null });
      }
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
      if (room.round?.mode === 'imposter') broadcastImposterWords(room);
      if (room.round?.mode === 'codenames') broadcastCodenamesKeys(room);
      if (room.round?.mode === 'ticket-to-ride') broadcastTtrPrivate(room);
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

  /**
   * Relance immédiatement une nouvelle partie sans repasser par le lobby.
   * Utile pour les modes "exclusifs" (qui-est-ce, imposter, codenames) pour
   * lesquels le lobby n'a pas de réglage supplémentaire à faire.
   */
  socket.on('match:replay', (...args: unknown[]) => {
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
    try {
      // Le startGame remet les scores à 0 et rebâtit la playlist.
      room.startGame();
      if (room.round) {
        io.to(room.code).emit('round:started', room.snapshot());
      }
      broadcastRoom(room);
      if (room.round?.mode === 'ticket-to-ride') broadcastTtrPrivate(room);
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
      const { eliminatedTargetId, revealedAvatar, completed } = room.gwNextTurn(playerId);
      if (eliminatedTargetId && revealedAvatar) {
        io.to(room.code).emit('guessWho:playerEliminated', {
          playerId: eliminatedTargetId,
          revealedAvatar,
        });
      }
      if (completed) {
        room.goToReveal();
        if (room.round?.reveal) io.to(room.code).emit('round:reveal', room.round.reveal);
      }
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
      const { eliminatedTargetId, revealedAvatar, completed } = room.gwSelfEliminate(playerId);
      if (eliminatedTargetId && revealedAvatar) {
        io.to(room.code).emit('guessWho:playerEliminated', {
          playerId: eliminatedTargetId,
          revealedAvatar,
        });
      }
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

  // `guessWho:guess` : retour 100% privé (via ack). Aucune info leakée côté
  // public : l'état du serveur change (pendingGuesses + guessBans) mais
  // l'instantané broadcast ne les expose pas. On s'abstient donc de broadcast
  // pour éviter le moindre changement observable et économiser du traffic.
  socket.on('guessWho:guess', (payload, ack) => {
    const parsed = GuessWhoGuessPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`gwguess:${playerId}`, 10, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de tentatives' });
    }
    try {
      const { correct } = room.gwGuess(playerId, parsed.data.avatarSrc);
      ack({ ok: true, data: { correct } });
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('imposter:submitClue', (payload, ack) => {
    const parsed = ImposterSubmitCluePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`imclue:${playerId}`, 8, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de soumissions' });
    }
    try {
      room.imSubmitClue(playerId, parsed.data.clue);
      ack({ ok: true, data: null });
      io.to(room.code).emit('imposter:clueSubmitted', { playerId });
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

  socket.on('imposter:vote', (payload, ack) => {
    const parsed = ImposterVotePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`imvote:${playerId}`, 4, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de votes' });
    }
    try {
      room.imVote(playerId, parsed.data.targetId);
      ack({ ok: true, data: null });
      io.to(room.code).emit('imposter:voted', { playerId });
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

  socket.on('imposter:guessWord', (payload, ack) => {
    const parsed = ImposterGuessPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`imguess:${playerId}`, 3, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de tentatives' });
    }
    try {
      room.imSubmitGuess(playerId, parsed.data.guess);
      ack({ ok: true, data: null });
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

  socket.on('lobby:codenames:setTeam', (payload, ack) => {
    const parsed = CodenamesSetTeamPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`cnteam:${playerId}`, 20, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de changements' });
    }
    try {
      room.setCnTeam(playerId, parsed.data.team);
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

  socket.on('ttr:confirmInitialDestinations', (payload, ack) => {
    const parsed = TicketToRideKeepDestinationsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (!room.round || room.round.collect.kind !== 'ticket-to-ride') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Mauvaise phase' });
    }
    const res = ttrConfirmInitialDestinations(
      room.round.collect.ttr,
      playerId,
      parsed.data.kept,
      Date.now(),
    );
    if (!res.ok) return ack({ ok: false, code: res.code, message: res.message });
    ack({ ok: true, data: null });
    broadcastRoom(room);
    broadcastTtrPrivate(room);
  });

  socket.on('ttr:drawFromDeck', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`ttr:${playerId}`, 40, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop d’actions' });
    }
    if (!room.round || room.round.collect.kind !== 'ticket-to-ride') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Mauvaise phase' });
    }
    const res = ttrDrawFromDeck(room.round.collect.ttr, playerId, Date.now());
    if (!res.ok) return ack({ ok: false, code: res.code, message: res.message });
    ack({ ok: true, data: null });
    maybeAutoReveal(room);
    broadcastRoom(room);
    broadcastTtrPrivate(room);
  });

  socket.on('ttr:drawFromMarket', (payload, ack) => {
    const parsed = TicketToRideDrawFromMarketPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`ttr:${playerId}`, 40, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop d’actions' });
    }
    if (!room.round || room.round.collect.kind !== 'ticket-to-ride') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Mauvaise phase' });
    }
    const res = ttrDrawFromMarket(
      room.round.collect.ttr,
      playerId,
      parsed.data.slot,
      Date.now(),
    );
    if (!res.ok) return ack({ ok: false, code: res.code, message: res.message });
    ack({ ok: true, data: null });
    maybeAutoReveal(room);
    broadcastRoom(room);
    broadcastTtrPrivate(room);
  });

  socket.on('ttr:claimRoute', (payload, ack) => {
    const parsed = TicketToRideClaimRoutePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`ttr:${playerId}`, 40, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop d’actions' });
    }
    if (!room.round || room.round.collect.kind !== 'ticket-to-ride') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Mauvaise phase' });
    }
    const res = ttrClaimRoute(
      room.round.collect.ttr,
      playerId,
      parsed.data.routeId,
      parsed.data.paidColor,
      parsed.data.locoCount,
      Date.now(),
    );
    if (!res.ok) return ack({ ok: false, code: res.code, message: res.message });
    ack({ ok: true, data: null });
    maybeAutoReveal(room);
    broadcastRoom(room);
    broadcastTtrPrivate(room);
  });

  socket.on('ttr:drawDestinations', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`ttr:${playerId}`, 40, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop d’actions' });
    }
    if (!room.round || room.round.collect.kind !== 'ticket-to-ride') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Mauvaise phase' });
    }
    const res = ttrDrawDestinations(room.round.collect.ttr, playerId);
    if (!res.ok) return ack({ ok: false, code: res.code, message: res.message });
    ack({ ok: true, data: null });
    broadcastRoom(room);
    broadcastTtrPrivate(room);
  });

  socket.on('ttr:keepDestinations', (payload, ack) => {
    const parsed = TicketToRideKeepDestinationsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`ttr:${playerId}`, 40, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop d’actions' });
    }
    if (!room.round || room.round.collect.kind !== 'ticket-to-ride') {
      return ack({ ok: false, code: ERROR_CODES.PHASE_MISMATCH, message: 'Mauvaise phase' });
    }
    const res = ttrKeepDestinations(
      room.round.collect.ttr,
      playerId,
      parsed.data.kept,
      Date.now(),
    );
    if (!res.ok) return ack({ ok: false, code: res.code, message: res.message });
    ack({ ok: true, data: null });
    maybeAutoReveal(room);
    broadcastRoom(room);
    broadcastTtrPrivate(room);
  });

  socket.on('lobby:codenames:setSpymaster', (payload, ack) => {
    const parsed = CodenamesSetSpymasterPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`cnspy:${playerId}`, 20, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de changements' });
    }
    try {
      room.setCnWantsSpymaster(playerId, parsed.data.wants);
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

  socket.on('codenames:submitClue', (payload, ack) => {
    const parsed = CodenamesSubmitCluePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`cnclue:${playerId}`, 10, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de soumissions' });
    }
    try {
      room.cnSubmitClue(playerId, parsed.data.word, parsed.data.count);
      ack({ ok: true, data: null });
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

  socket.on('codenames:guessTile', (payload, ack) => {
    const parsed = CodenamesGuessTilePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`cnguess:${playerId}`, 30, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de clics' });
    }
    try {
      room.cnGuessTile(playerId, parsed.data.index);
      ack({ ok: true, data: null });
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

  socket.on('codenames:endTurn', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    if (hitRateLimit(`cnend:${playerId}`, 10, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de clics' });
    }
    try {
      room.cnEndTurn(playerId);
      ack({ ok: true, data: null });
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

  socket.on('wikirace:navigate', (payload, ack) => {
    const parsed = WikiraceNavigatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    // Un clic ≈ 1 nav : on tolère une courte rafale (plusieurs onglets ouverts).
    if (hitRateLimit(`wrnav:${playerId}`, 40, 10_000)) {
      return ack({ ok: false, code: ERROR_CODES.RATE_LIMITED, message: 'Trop de navigations' });
    }
    try {
      const res = room.wrNavigate(playerId, parsed.data.title);
      ack({ ok: true, data: res });
      broadcastRoom(room);
      maybeAutoReveal(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('wikirace:abandon', (...args: unknown[]) => {
    const ack = (args.find((a) => typeof a === 'function') ?? (() => {})) as (
      res: unknown,
    ) => void;
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      room.wrAbandon(playerId);
      ack({ ok: true, data: null });
      broadcastRoom(room);
      maybeAutoReveal(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  // ============================== GARTIC PHONE ==============================

  socket.on('garticPhone:submitText', (payload, ack) => {
    const parsed = GarticPhoneSubmitTextPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      room.gpSubmitText(playerId, parsed.data.text);
      ack({ ok: true, data: null });
      // Si l'étape a avancé (tous ont soumis), envoyer les nouveaux prompts
      broadcastGarticPrompts(room);
      broadcastRoom(room);
      maybeAutoReveal(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('garticPhone:advanceReveal', (payload, ack) => {
    const parsed = GarticPhoneAdvanceRevealPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      room.gpAdvanceReveal(playerId);
      ack({ ok: true, data: null });
      broadcastRoom(room);
      maybeAutoReveal(room);
    } catch (e) {
      const code = (e as Error).message;
      return ack({
        ok: false,
        code: (ERROR_CODES as Record<string, string>)[code] ?? ERROR_CODES.INTERNAL,
        message: (e as Error).message,
      });
    }
  });

  socket.on('garticPhone:submitDrawing', (payload, ack) => {
    const parsed = GarticPhoneSubmitDrawingPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return ack({ ok: false, code: ERROR_CODES.INVALID_PAYLOAD, message: 'Payload invalide' });
    }
    const { room, playerId } = socketRoom(socket);
    if (!room || !playerId) {
      return ack({ ok: false, code: ERROR_CODES.NOT_IN_ROOM, message: 'Pas dans un salon' });
    }
    try {
      room.gpSubmitDrawing(playerId, parsed.data.dataUrl);
      ack({ ok: true, data: null });
      broadcastGarticPrompts(room);
      broadcastRoom(room);
      maybeAutoReveal(room);
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

  socket.on('tv:sync', (...args: unknown[]) => {
    const ack = args[args.length - 1] as (res: unknown) => void;
    if (typeof ack !== 'function') return;
    ack({ ok: true, data: tv.getState() });
  });

  socket.on('tv:skip', (...args: unknown[]) => {
    const ack = args[args.length - 1] as (res: unknown) => void;
    if (typeof ack !== 'function') return;
    if (hitRateLimit(`tv:skip:${socket.id}`, 3, 10_000)) {
      return ack({
        ok: false,
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Doucement sur le zapping',
      });
    }
    const state = tv.skip();
    ack({ ok: true, data: state });
  });

  // Push l'état courant aux nouveaux arrivants pour qu'ils se synchronisent.
  socket.emit('radio:state', radio.getState());
  socket.emit('tv:state', tv.getState());

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
  // On ne retire jamais un joueur immédiatement : on le marque déconnecté et
  // on laisse une période de grâce pour qu'il revienne (changement d'onglet,
  // écran verrouillé, micro-coupure réseau…).
  room.setPlayerConnected(playerId, false);
  if (room.hostId === playerId && !room.activePlayers().some((p) => p.id === playerId)) {
    room.reassignHost();
  }
  broadcastRoom(room);
  if (room.phase === 'lobby' || room.phase === 'match_final') {
    scheduleLobbyEviction(room.code, playerId);
  }
  // Wikirace : si le dernier joueur connecté abandonne en partant, on clôt.
  maybeAutoReveal(room);
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
