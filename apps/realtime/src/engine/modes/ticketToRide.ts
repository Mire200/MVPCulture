import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  RoundEvent,
  RoundState,
  TicketToRideState,
  TtrPlayerState,
} from '../types.js';
import type {
  AnswerPayload,
  Player,
  RoundReveal,
  RoundScoring,
  TicketToRideQuestion,
  TTRRoute,
} from '@mvpc/shared';
import {
  DEFAULT_TTR_MAP_ID,
  getTtrMap,
  TTR_CARD_COLORS,
  TTR_CARDS_PER_COLOR,
  TTR_INITIAL_DESTINATIONS_DRAW,
  TTR_INITIAL_DESTINATIONS_KEEP_MIN,
  TTR_LAST_ROUND_TRAIN_THRESHOLD,
  TTR_LOCOMOTIVES_IN_DECK,
  TTR_LONGEST_PATH_BONUS,
  TTR_MARKET_LOCO_RESHUFFLE,
  TTR_MARKET_SIZE,
  TTR_MIDGAME_DESTINATIONS_DRAW,
  TTR_MIDGAME_DESTINATIONS_KEEP_MIN,
  TTR_ROUTE_POINTS,
} from '@mvpc/shared';

/** Durée max d'un tour (ms) avant d'être auto-skippé. */
export const TTR_TURN_MS = 90_000;
/** Durée accordée aux joueurs pour choisir leurs billets initiaux. */
export const TTR_INITIAL_DEST_MS = 60_000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildDeck(): string[] {
  const deck: string[] = [];
  for (const c of TTR_CARD_COLORS) {
    for (let i = 0; i < TTR_CARDS_PER_COLOR; i++) deck.push(c);
  }
  for (let i = 0; i < TTR_LOCOMOTIVES_IN_DECK; i++) deck.push('loco');
  return shuffle(deck);
}

function drawCardFromDeck(ttr: TicketToRideState): string | null {
  if (ttr.deck.length === 0) {
    if (ttr.discard.length === 0) return null;
    ttr.deck = shuffle(ttr.discard);
    ttr.discard = [];
  }
  return ttr.deck.pop() ?? null;
}

function emptyHand(): Record<string, number> {
  const h: Record<string, number> = { loco: 0 };
  for (const c of TTR_CARD_COLORS) h[c] = 0;
  return h;
}

function locoCountInMarket(market: (string | null)[]): number {
  return market.filter((c) => c === 'loco').length;
}

function routesFor(ttr: TicketToRideState): TTRRoute[] {
  return getTtrMap(ttr.mapId).routes;
}

export function ttrRefillMarket(ttr: TicketToRideState): void {
  for (let i = 0; i < TTR_MARKET_SIZE; i++) {
    if (ttr.market[i] == null) {
      const c = drawCardFromDeck(ttr);
      ttr.market[i] = c;
    }
  }
  // Reshuffle si ≥3 locomotives visibles et au moins 3 non-locos dispo (deck+discard).
  let safety = 5;
  while (locoCountInMarket(ttr.market) >= TTR_MARKET_LOCO_RESHUFFLE && safety-- > 0) {
    const nonLocoAvailable =
      ttr.deck.filter((c) => c !== 'loco').length +
      ttr.discard.filter((c) => c !== 'loco').length;
    if (nonLocoAvailable < 3) break;
    // Reverser le marché en défausse et retirer 5 nouvelles.
    for (let i = 0; i < TTR_MARKET_SIZE; i++) {
      const c = ttr.market[i];
      if (c) ttr.discard.push(c);
      ttr.market[i] = null;
    }
    for (let i = 0; i < TTR_MARKET_SIZE; i++) {
      ttr.market[i] = drawCardFromDeck(ttr);
    }
  }
}

/** Renvoie la liste des couleurs pour lesquelles le joueur a assez de cartes
 * (y compris en combinant avec des locos) pour payer cette route.
 */
export function ttrPayableColorsFor(
  ttr: TicketToRideState,
  playerId: string,
  routeId: string,
): Array<{ color: string; locoCount: number }> {
  const route = routesFor(ttr).find((r) => r.id === routeId);
  if (!route) return [];
  const owned = ttr.routes.find((r) => r.id === routeId);
  if (!owned || owned.ownerId) return [];
  const player = ttr.players.get(playerId);
  if (!player || player.trainsLeft < route.length) return [];
  const loco = player.hand.loco ?? 0;
  const options: Array<{ color: string; locoCount: number }> = [];
  const colorsToTry = route.color === 'gray' ? [...TTR_CARD_COLORS] : [route.color];
  for (const c of colorsToTry) {
    const have = player.hand[c] ?? 0;
    for (let lc = 0; lc <= Math.min(loco, route.length); lc++) {
      if (have + lc >= route.length) {
        options.push({ color: c, locoCount: lc });
        break;
      }
    }
  }
  // Route payable uniquement en locos.
  if ((player.hand.loco ?? 0) >= route.length) {
    options.push({ color: 'loco', locoCount: route.length });
  }
  return options;
}

function advanceTurn(ttr: TicketToRideState, now: number): RoundEvent[] {
  ttr.turnAction = { kind: 'idle' };
  const events: RoundEvent[] = [];
  // Fin de manche si le dernier tour a été joué par tous.
  if (ttr.sub === 'last-round') {
    const triggerId = ttr.lastRoundTriggerId!;
    const nextIdx = (ttr.currentPlayerIndex + 1) % ttr.turnOrder.length;
    // On finit le cycle : le trigger a joué son dernier tour, puis chacun un tour.
    // On marque chaque joueur qui a fini son "dernier tour" via un compteur.
    ttr.lastRoundTurnsRemaining = Math.max(0, (ttr.lastRoundTurnsRemaining ?? 0) - 1);
    if (ttr.lastRoundTurnsRemaining <= 0) {
      ttr.sub = 'done';
      events.push({ type: 'ttr_done' });
      return events;
    }
    ttr.currentPlayerIndex = nextIdx;
    ttr.turnEndsAt = now + TTR_TURN_MS;
    events.push({ type: 'ttr_turn_started', currentPlayerId: ttr.turnOrder[nextIdx]! });
    return events;
  }
  // Déclenchement du dernier tour ?
  const curId = ttr.turnOrder[ttr.currentPlayerIndex]!;
  const curPlayer = ttr.players.get(curId);
  if (
    curPlayer &&
    curPlayer.trainsLeft <= TTR_LAST_ROUND_TRAIN_THRESHOLD &&
    !ttr.lastRoundTriggerId
  ) {
    ttr.lastRoundTriggerId = curId;
    ttr.sub = 'last-round';
    // Chaque joueur (y compris le trigger qui vient de jouer) joue encore 1 tour.
    // Le trigger a joué, il reste N-1 autres, puis "le trigger joue encore ?
    // Non : règle officielle = le trigger (incl.) a un dernier tour. Comme il
    // vient de le jouer, il reste turnOrder.length - 1 tours à l'ensemble.
    ttr.lastRoundTurnsRemaining = ttr.turnOrder.length - 1;
    events.push({ type: 'ttr_last_round_triggered', playerId: curId });
    if (ttr.lastRoundTurnsRemaining <= 0) {
      ttr.sub = 'done';
      events.push({ type: 'ttr_done' });
      return events;
    }
    ttr.currentPlayerIndex = (ttr.currentPlayerIndex + 1) % ttr.turnOrder.length;
    ttr.turnEndsAt = now + TTR_TURN_MS;
    events.push({ type: 'ttr_turn_started', currentPlayerId: ttr.turnOrder[ttr.currentPlayerIndex]! });
    return events;
  }
  ttr.currentPlayerIndex = (ttr.currentPlayerIndex + 1) % ttr.turnOrder.length;
  ttr.turnEndsAt = now + TTR_TURN_MS;
  events.push({ type: 'ttr_turn_started', currentPlayerId: ttr.turnOrder[ttr.currentPlayerIndex]! });
  return events;
}

function startPlaying(ttr: TicketToRideState, now: number): RoundEvent[] {
  ttr.sub = 'playing';
  ttr.currentPlayerIndex = 0;
  ttr.turnEndsAt = now + TTR_TURN_MS;
  ttr.turnAction = { kind: 'idle' };
  return [{ type: 'ttr_turn_started', currentPlayerId: ttr.turnOrder[0]! }];
}

export function ttrConfirmInitialDestinations(
  ttr: TicketToRideState,
  playerId: string,
  kept: string[],
  now: number,
): { ok: true; events: RoundEvent[] } | { ok: false; code: string; message: string } {
  if (ttr.sub !== 'initial-destinations') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Pas en phase initiale.' };
  }
  const p = ttr.players.get(playerId);
  if (!p) return { ok: false, code: 'NOT_IN_ROOM', message: 'Joueur introuvable.' };
  if (p.initialDestinationsConfirmed) {
    return { ok: false, code: 'ALREADY_ANSWERED', message: 'Déjà confirmé.' };
  }
  const offered = ttr.initialDestinationsDrawn.get(playerId) ?? [];
  if (kept.length < TTR_INITIAL_DESTINATIONS_KEEP_MIN) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Au moins 2 billets requis.' };
  }
  for (const id of kept) {
    if (!offered.includes(id)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Billet non proposé.' };
    }
  }
  const rejected = offered.filter((id) => !kept.includes(id));
  p.destinations = [...kept];
  p.initialDestinationsConfirmed = true;
  // Billets refusés retournent en bas de la pile (officiellement : au fond).
  ttr.destinationDeck.push(...rejected);
  ttr.initialDestinationsDrawn.delete(playerId);
  const events: RoundEvent[] = [];
  const allConfirmed = [...ttr.players.values()].every((pl) => pl.initialDestinationsConfirmed);
  if (allConfirmed) {
    events.push(...startPlaying(ttr, now));
  }
  return { ok: true, events };
}

export function ttrDrawFromDeck(
  ttr: TicketToRideState,
  playerId: string,
  now: number,
): { ok: true; events: RoundEvent[] } | { ok: false; code: string; message: string } {
  if (ttr.sub !== 'playing' && ttr.sub !== 'last-round') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Pas ton tour.' };
  }
  if (ttr.turnOrder[ttr.currentPlayerIndex] !== playerId) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: 'Pas ton tour.' };
  }
  const p = ttr.players.get(playerId)!;
  if (ttr.turnAction.kind === 'picking-destinations') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Termine tes billets.' };
  }
  const card = drawCardFromDeck(ttr);
  if (!card) {
    if (ttr.turnAction.kind === 'drew-one') {
      return { ok: true, events: advanceTurn(ttr, now) };
    }
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Pioche vide.' };
  }
  p.hand[card] = (p.hand[card] ?? 0) + 1;
  const events: RoundEvent[] = [
    { type: 'ttr_card_drawn', playerId, fromMarket: false },
  ];
  if (ttr.turnAction.kind === 'idle') {
    ttr.turnAction = { kind: 'drew-one', tookLoco: false };
    return { ok: true, events };
  }
  // 'drew-one' : fin de tour
  events.push(...advanceTurn(ttr, now));
  return { ok: true, events };
}

export function ttrDrawFromMarket(
  ttr: TicketToRideState,
  playerId: string,
  slot: number,
  now: number,
): { ok: true; events: RoundEvent[] } | { ok: false; code: string; message: string } {
  if (ttr.sub !== 'playing' && ttr.sub !== 'last-round') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Pas en phase de jeu.' };
  }
  if (ttr.turnOrder[ttr.currentPlayerIndex] !== playerId) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: 'Pas ton tour.' };
  }
  if (ttr.turnAction.kind === 'picking-destinations') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Termine tes billets.' };
  }
  const card = ttr.market[slot];
  if (!card) return { ok: false, code: 'INVALID_PAYLOAD', message: 'Emplacement vide.' };
  const p = ttr.players.get(playerId)!;
  const isLoco = card === 'loco';
  // Règle : loco visible = action complète (seule carte du tour). Interdit si c'est la 2e pioche.
  if (isLoco && ttr.turnAction.kind === 'drew-one') {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Loco interdite en 2e pioche.' };
  }
  p.hand[card] = (p.hand[card] ?? 0) + 1;
  ttr.market[slot] = null;
  ttrRefillMarket(ttr);
  const events: RoundEvent[] = [
    { type: 'ttr_card_drawn', playerId, fromMarket: true },
  ];
  if (isLoco) {
    events.push(...advanceTurn(ttr, now));
    return { ok: true, events };
  }
  if (ttr.turnAction.kind === 'idle') {
    ttr.turnAction = { kind: 'drew-one', tookLoco: false };
    return { ok: true, events };
  }
  events.push(...advanceTurn(ttr, now));
  return { ok: true, events };
}

export function ttrClaimRoute(
  ttr: TicketToRideState,
  playerId: string,
  routeId: string,
  paidColor: string,
  locoCount: number,
  now: number,
): { ok: true; events: RoundEvent[] } | { ok: false; code: string; message: string } {
  if (ttr.sub !== 'playing' && ttr.sub !== 'last-round') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Pas en phase de jeu.' };
  }
  if (ttr.turnOrder[ttr.currentPlayerIndex] !== playerId) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: 'Pas ton tour.' };
  }
  if (ttr.turnAction.kind !== 'idle') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Action déjà commencée.' };
  }
  const route = routesFor(ttr).find((r) => r.id === routeId);
  if (!route) return { ok: false, code: 'INVALID_PAYLOAD', message: 'Route inconnue.' };
  const owned = ttr.routes.find((r) => r.id === routeId)!;
  if (owned.ownerId) return { ok: false, code: 'PHASE_MISMATCH', message: 'Déjà prise.' };
  const p = ttr.players.get(playerId)!;
  if (p.trainsLeft < route.length) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Pas assez de wagons.' };
  }
  if (locoCount < 0 || locoCount > route.length) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Paiement invalide.' };
  }
  const colorNeeded = route.length - locoCount;
  if (paidColor === 'loco') {
    // Paiement intégral en locomotives.
    if (locoCount !== route.length) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Paiement loco incomplet.' };
    }
  } else {
    if (!TTR_CARD_COLORS.includes(paidColor as typeof TTR_CARD_COLORS[number])) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Couleur invalide.' };
    }
    if (route.color !== 'gray' && paidColor !== route.color) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Mauvaise couleur.' };
    }
  }
  const haveColor = p.hand[paidColor === 'loco' ? 'loco' : paidColor] ?? 0;
  const haveLoco = p.hand.loco ?? 0;
  if (paidColor === 'loco') {
    if (haveLoco < route.length) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Pas assez de locomotives.' };
    }
    p.hand.loco = haveLoco - route.length;
    for (let i = 0; i < route.length; i++) ttr.discard.push('loco');
  } else {
    if (haveColor < colorNeeded || haveLoco < locoCount) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Paiement insuffisant.' };
    }
    p.hand[paidColor] = haveColor - colorNeeded;
    p.hand.loco = haveLoco - locoCount;
    for (let i = 0; i < colorNeeded; i++) ttr.discard.push(paidColor);
    for (let i = 0; i < locoCount; i++) ttr.discard.push('loco');
  }
  p.trainsLeft -= route.length;
  p.claimedRouteIds.push(routeId);
  const points = TTR_ROUTE_POINTS[route.length] ?? 0;
  p.scoreFromRoutes += points;
  owned.ownerId = playerId;
  owned.paidColor = paidColor;
  const events: RoundEvent[] = [
    { type: 'ttr_route_claimed', playerId, routeId, length: route.length },
  ];
  if (ttr.routes.every((r) => r.ownerId)) {
    ttr.sub = 'done';
    events.push({ type: 'ttr_done' });
    return { ok: true, events };
  }
  events.push(...advanceTurn(ttr, now));
  return { ok: true, events };
}

export function ttrDrawDestinations(
  ttr: TicketToRideState,
  playerId: string,
): { ok: true; events: RoundEvent[] } | { ok: false; code: string; message: string } {
  if (ttr.sub !== 'playing' && ttr.sub !== 'last-round') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Pas en phase de jeu.' };
  }
  if (ttr.turnOrder[ttr.currentPlayerIndex] !== playerId) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: 'Pas ton tour.' };
  }
  if (ttr.turnAction.kind !== 'idle') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Action déjà commencée.' };
  }
  const drawn: string[] = [];
  for (let i = 0; i < TTR_MIDGAME_DESTINATIONS_DRAW; i++) {
    const d = ttr.destinationDeck.shift();
    if (d) drawn.push(d);
  }
  if (drawn.length === 0) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Pioche de billets vide.' };
  }
  ttr.turnAction = {
    kind: 'picking-destinations',
    drawn,
    minKeep: TTR_MIDGAME_DESTINATIONS_KEEP_MIN,
  };
  return { ok: true, events: [] };
}

export function ttrKeepDestinations(
  ttr: TicketToRideState,
  playerId: string,
  kept: string[],
  now: number,
): { ok: true; events: RoundEvent[] } | { ok: false; code: string; message: string } {
  if (ttr.sub !== 'playing' && ttr.sub !== 'last-round') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Pas en phase de jeu.' };
  }
  if (ttr.turnOrder[ttr.currentPlayerIndex] !== playerId) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: 'Pas ton tour.' };
  }
  if (ttr.turnAction.kind !== 'picking-destinations') {
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Aucun billet à choisir.' };
  }
  const drawn = ttr.turnAction.drawn;
  const minKeep = ttr.turnAction.minKeep;
  if (kept.length < minKeep) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: `Au moins ${minKeep} billet(s).` };
  }
  for (const id of kept) {
    if (!drawn.includes(id)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Billet non proposé.' };
    }
  }
  const rejected = drawn.filter((id) => !kept.includes(id));
  const p = ttr.players.get(playerId)!;
  p.destinations.push(...kept);
  ttr.destinationDeck.push(...rejected);
  const events: RoundEvent[] = [
    { type: 'ttr_destinations_taken', playerId, count: kept.length },
  ];
  events.push(...advanceTurn(ttr, now));
  return { ok: true, events };
}

export function ttrPrivateFor(
  ttr: TicketToRideState,
  playerId: string,
): {
  hand: Record<string, number>;
  destinations: string[];
  pendingDraw?: string[];
  pendingIsInitial?: boolean;
} | undefined {
  const p = ttr.players.get(playerId);
  if (!p) return undefined;
  let pendingDraw: string[] | undefined;
  let pendingIsInitial = false;
  if (ttr.sub === 'initial-destinations' && !p.initialDestinationsConfirmed) {
    pendingDraw = ttr.initialDestinationsDrawn.get(playerId);
    pendingIsInitial = true;
  } else if (
    ttr.turnAction.kind === 'picking-destinations' &&
    ttr.turnOrder[ttr.currentPlayerIndex] === playerId
  ) {
    pendingDraw = [...ttr.turnAction.drawn];
  }
  return {
    hand: { ...p.hand },
    destinations: [...p.destinations],
    pendingDraw,
    pendingIsInitial,
  };
}

export function ttrTick(
  ttr: TicketToRideState,
  now: number,
): { advanced: boolean; completed: boolean; ttrEvents: RoundEvent[] } {
  if (ttr.sub === 'done') return { advanced: false, completed: true, ttrEvents: [] };
  if (ttr.sub === 'initial-destinations') {
    // Timeout de la phase initiale : on force-confirme ceux qui n'ont pas choisi.
    if (ttr.turnEndsAt && now >= ttr.turnEndsAt) {
      let changed = false;
      for (const [pid, p] of ttr.players.entries()) {
        if (!p.initialDestinationsConfirmed) {
          const offered = ttr.initialDestinationsDrawn.get(pid) ?? [];
          const keep = offered.slice(0, TTR_INITIAL_DESTINATIONS_KEEP_MIN);
          const rejected = offered.slice(TTR_INITIAL_DESTINATIONS_KEEP_MIN);
          p.destinations = keep;
          p.initialDestinationsConfirmed = true;
          ttr.destinationDeck.push(...rejected);
          ttr.initialDestinationsDrawn.delete(pid);
          changed = true;
        }
      }
      if (changed) {
        const evts = startPlaying(ttr, now);
        return { advanced: true, completed: false, ttrEvents: evts };
      }
    }
    return { advanced: false, completed: false, ttrEvents: [] };
  }
  if (ttr.turnEndsAt && now >= ttr.turnEndsAt) {
    // Timeout du tour : on skippe simplement (pas de carte piochée).
    const events = advanceTurn(ttr, now);
    return { advanced: true, completed: events.some((ev) => ev.type === 'ttr_done'), ttrEvents: events };
  }
  return { advanced: false, completed: false, ttrEvents: [] };
}

// ---- Scoring ----

function areCitiesConnectedByOwner(
  routes: TTRRoute[],
  claimedRouteIds: string[],
  cityA: string,
  cityB: string,
): boolean {
  if (cityA === cityB) return true;
  const adj = new Map<string, Set<string>>();
  for (const id of claimedRouteIds) {
    const r = routes.find((rt) => rt.id === id);
    if (!r) continue;
    if (!adj.has(r.cityA)) adj.set(r.cityA, new Set());
    if (!adj.has(r.cityB)) adj.set(r.cityB, new Set());
    adj.get(r.cityA)!.add(r.cityB);
    adj.get(r.cityB)!.add(r.cityA);
  }
  const visited = new Set<string>([cityA]);
  const queue: string[] = [cityA];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === cityB) return true;
    for (const nb of adj.get(cur) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

function computeLongestPathLength(routes: TTRRoute[], claimedRouteIds: string[]): number {
  // Chaque route ne peut être traversée qu'une fois ; on cherche le chemin
  // eulérien le plus long (en trains). DFS avec backtracking.
  const edges = claimedRouteIds
    .map((id) => routes.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r);
  if (edges.length === 0) return 0;
  const adj = new Map<string, Array<{ to: string; edgeId: string; len: number }>>();
  for (const e of edges) {
    if (!adj.has(e.cityA)) adj.set(e.cityA, []);
    if (!adj.has(e.cityB)) adj.set(e.cityB, []);
    adj.get(e.cityA)!.push({ to: e.cityB, edgeId: e.id, len: e.length });
    adj.get(e.cityB)!.push({ to: e.cityA, edgeId: e.id, len: e.length });
  }
  let best = 0;
  const used = new Set<string>();
  function dfs(node: string, total: number) {
    if (total > best) best = total;
    for (const next of adj.get(node) ?? []) {
      if (used.has(next.edgeId)) continue;
      used.add(next.edgeId);
      dfs(next.to, total + next.len);
      used.delete(next.edgeId);
    }
  }
  for (const start of adj.keys()) dfs(start, 0);
  return best;
}

export const ticketToRideMode: GameMode = {
  id: 'ticket-to-ride',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question as TicketToRideQuestion;
    const mapId = ctx.config.ttrMapId ?? DEFAULT_TTR_MAP_ID;
    const map = getTtrMap(mapId);
    const deck = buildDeck();
    const destinationDeck = shuffle(map.destinations.map((d) => d.id));

    const players = new Map<string, TtrPlayerState>();
    const initialDrawn = new Map<string, string[]>();
    const turnOrder = shuffle(ctx.players.map((p) => p.id));

    // Distribue 4 cartes à chaque joueur puis 3 billets destination initiaux.
    for (const pid of turnOrder) {
      const hand = emptyHand();
      for (let i = 0; i < 4; i++) {
        const c = deck.pop();
        if (c) hand[c] = (hand[c] ?? 0) + 1;
      }
      players.set(pid, {
        trainsLeft: map.trainsPerPlayer ?? 45,
        hand,
        destinations: [],
        claimedRouteIds: [],
        scoreFromRoutes: 0,
        initialDestinationsConfirmed: false,
      });
      const initDests: string[] = [];
      for (let i = 0; i < TTR_INITIAL_DESTINATIONS_DRAW; i++) {
        const d = destinationDeck.shift();
        if (d) initDests.push(d);
      }
      initialDrawn.set(pid, initDests);
    }

    const market: (string | null)[] = new Array(TTR_MARKET_SIZE).fill(null);
    const ttr: TicketToRideState = {
      mapId,
      sub: 'initial-destinations',
      turnOrder,
      currentPlayerIndex: 0,
      turnEndsAt: ctx.now() + TTR_INITIAL_DEST_MS,
      deck,
      discard: [],
      market,
      destinationDeck,
      initialDestinationsDrawn: initialDrawn,
      players,
      routes: map.routes.map((r) => ({ id: r.id })),
      turnAction: { kind: 'idle' },
    };
    ttrRefillMarket(ttr);

    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion: {
        id: q.id,
        mode: 'ticket-to-ride',
        difficulty: q.difficulty,
        category: q.category,
        prompt: q.prompt || 'Aventuriers du Rail',
      },
      mode: 'ticket-to-ride',
      collect: { kind: 'ticket-to-ride', ttr },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(): AcceptAnswerResult {
    // Pas d'acceptAnswer pour TTR : tout passe par les handlers dédiés.
    return { ok: false, code: 'PHASE_MISMATCH', message: 'Utilise les actions TTR dédiées.' };
  },

  isCollectComplete(state) {
    if (state.collect.kind !== 'ticket-to-ride') return true;
    return state.collect.ttr.sub === 'done';
  },

  buildReveal(state): RoundReveal {
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers: [],
      autoValidations: {},
    };
  },

  computeScores(state, players: Player[]): RoundScoring {
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    if (state.collect.kind !== 'ticket-to-ride') {
      for (const p of players) {
        deltas[p.id] = 0;
        totals[p.id] = p.score;
      }
      return { roundIndex: state.roundIndex, deltas, totals, officialAnswer: 'Fin de partie' };
    }
    const ttr = state.collect.ttr;
    const map = getTtrMap(ttr.mapId);

    // Destinations : +points si complétée, -points sinon.
    const destinationScore: Record<string, number> = {};
    for (const pid of ttr.turnOrder) {
      const p = ttr.players.get(pid);
      if (!p) continue;
      let s = 0;
      for (const dId of p.destinations) {
        const dest = map.destinations.find((d) => d.id === dId);
        if (!dest) continue;
        const connected = areCitiesConnectedByOwner(map.routes, p.claimedRouteIds, dest.cityA, dest.cityB);
        s += connected ? dest.points : -dest.points;
      }
      destinationScore[pid] = s;
    }

    // Longest path : bonus (partagé en cas d'égalité).
    const longest: Record<string, number> = {};
    for (const pid of ttr.turnOrder) {
      const p = ttr.players.get(pid);
      longest[pid] = p ? computeLongestPathLength(map.routes, p.claimedRouteIds) : 0;
    }
    const maxLen = Math.max(0, ...Object.values(longest));
    const bonusIds = new Set(
      Object.entries(longest)
        .filter(([, v]) => v === maxLen && v > 0)
        .map(([id]) => id),
    );

    for (const p of players) {
      const ps = ttr.players.get(p.id);
      const base = ps?.scoreFromRoutes ?? 0;
      const dest = destinationScore[p.id] ?? 0;
      const bonus = bonusIds.has(p.id) ? TTR_LONGEST_PATH_BONUS : 0;
      const delta = base + dest + bonus;
      deltas[p.id] = delta;
      totals[p.id] = p.score + delta;
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer: 'Fin de partie',
    };
  },
};
