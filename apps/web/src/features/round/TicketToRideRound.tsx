'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Map as MapIcon, Ticket, Train, Trophy } from 'lucide-react';
import { AvatarBadge } from '@/components/AvatarPicker';
import { getSocket } from '@/lib/socket';
import { mvpSound } from '@/lib/sound';
import { useGameStore } from '@/store/gameStore';
import {
  TTR_CARD_COLORS,
  TTR_CITIES,
  TTR_DESTINATIONS,
  TTR_ROUTES,
  TTR_ROUTE_POINTS,
} from '@mvpc/shared';

const CARD_META: Record<
  string,
  { label: string; fill: string; text: string; shadow: string; soft: string }
> = {
  red: { label: 'Rouge', fill: '#ef4444', text: '#fff', shadow: 'rgba(239,68,68,0.5)', soft: 'rgba(239,68,68,0.16)' },
  blue: { label: 'Bleu', fill: '#3b82f6', text: '#fff', shadow: 'rgba(59,130,246,0.5)', soft: 'rgba(59,130,246,0.16)' },
  green: { label: 'Vert', fill: '#22c55e', text: '#052e16', shadow: 'rgba(34,197,94,0.45)', soft: 'rgba(34,197,94,0.16)' },
  yellow: { label: 'Jaune', fill: '#facc15', text: '#422006', shadow: 'rgba(250,204,21,0.45)', soft: 'rgba(250,204,21,0.18)' },
  black: { label: 'Noir', fill: '#111827', text: '#fff', shadow: 'rgba(15,23,42,0.65)', soft: 'rgba(15,23,42,0.42)' },
  white: { label: 'Blanc', fill: '#f8fafc', text: '#0f172a', shadow: 'rgba(248,250,252,0.42)', soft: 'rgba(248,250,252,0.13)' },
  orange: { label: 'Orange', fill: '#fb923c', text: '#431407', shadow: 'rgba(251,146,60,0.45)', soft: 'rgba(251,146,60,0.16)' },
  pink: { label: 'Rose', fill: '#ec4899', text: '#fff', shadow: 'rgba(236,72,153,0.5)', soft: 'rgba(236,72,153,0.16)' },
  gray: { label: 'Gris', fill: '#94a3b8', text: '#0f172a', shadow: 'rgba(148,163,184,0.35)', soft: 'rgba(148,163,184,0.14)' },
  loco: { label: 'Loco', fill: '#a855f7', text: '#fff', shadow: 'rgba(168,85,247,0.55)', soft: 'rgba(168,85,247,0.18)' },
};

const CITY_LABEL_OFFSETS: Record<string, { x: number; y: number; anchor?: 'start' | 'middle' | 'end' }> = {
  paris: { x: 2.8, y: -2.6, anchor: 'start' },
  lille: { x: 0, y: -4 },
  strasbourg: { x: -2.6, y: -3.1, anchor: 'end' },
  lyon: { x: 3, y: -2.4, anchor: 'start' },
  marseille: { x: 0, y: 4.4 },
  nice: { x: 2.6, y: 1.1, anchor: 'start' },
  toulouse: { x: -2.8, y: 4.2, anchor: 'end' },
  bordeaux: { x: -3.4, y: 1.2, anchor: 'end' },
  nantes: { x: -3.4, y: 1.3, anchor: 'end' },
  brest: { x: 2.8, y: -2.6, anchor: 'start' },
  rennes: { x: -2.8, y: -3.2, anchor: 'end' },
  rouen: { x: -2.8, y: -3.4, anchor: 'end' },
  dijon: { x: 3.1, y: -2.9, anchor: 'start' },
  clermont: { x: -3.2, y: 0.6, anchor: 'end' },
  montpellier: { x: -3.2, y: 4.1, anchor: 'end' },
};

const FRANCE_BOUNDS = {
  minLon: -5.8,
  maxLon: 8.9,
  minLat: 41.25,
  maxLat: 51.25,
  padX: 6.5,
  padY: 5.5,
};

const CITY_GEO: Record<string, { lon: number; lat: number }> = {
  paris: { lon: 2.3522, lat: 48.8566 },
  lille: { lon: 3.0573, lat: 50.6292 },
  strasbourg: { lon: 7.7521, lat: 48.5734 },
  lyon: { lon: 4.8357, lat: 45.764 },
  marseille: { lon: 5.3698, lat: 43.2965 },
  nice: { lon: 7.262, lat: 43.7102 },
  toulouse: { lon: 1.4442, lat: 43.6047 },
  bordeaux: { lon: -0.5792, lat: 44.8378 },
  nantes: { lon: -1.5536, lat: 47.2184 },
  brest: { lon: -4.4861, lat: 48.3904 },
  rennes: { lon: -1.6778, lat: 48.1173 },
  rouen: { lon: 1.0993, lat: 49.4432 },
  dijon: { lon: 5.0415, lat: 47.322 },
  clermont: { lon: 3.087, lat: 45.7772 },
  montpellier: { lon: 3.8767, lat: 43.6108 },
};

const FRANCE_OUTLINE_GEO: Array<[number, number]> = [
  [-4.78, 48.44],
  [-4.15, 48.08],
  [-3.58, 48.78],
  [-2.25, 48.78],
  [-1.62, 49.66],
  [-0.18, 49.42],
  [1.08, 50.07],
  [2.82, 50.78],
  [4.15, 50.43],
  [4.82, 49.9],
  [6.15, 49.48],
  [7.45, 48.72],
  [7.65, 47.6],
  [6.75, 46.92],
  [6.95, 46.18],
  [6.6, 45.36],
  [7.18, 44.48],
  [7.62, 43.78],
  [7.18, 43.3],
  [5.9, 43.08],
  [4.66, 43.34],
  [3.08, 42.82],
  [1.55, 42.45],
  [0.35, 42.68],
  [-0.78, 43.05],
  [-1.54, 43.43],
  [-1.23, 44.35],
  [-1.12, 45.28],
  [-1.18, 46.12],
  [-1.78, 46.85],
  [-2.92, 47.48],
  [-4.25, 47.82],
  [-5.05, 48.12],
  [-4.78, 48.44],
];

const FRANCE_REGION_LINES: Array<Array<[number, number]>> = [
  [
    [-4.4, 48.1],
    [-2.0, 47.8],
    [0.1, 47.4],
    [2.3, 47.1],
    [4.9, 47.3],
    [7.4, 48.2],
  ],
  [
    [-1.3, 49.3],
    [0.8, 48.6],
    [2.35, 48.85],
    [4.8, 47.6],
    [6.7, 46.4],
  ],
  [
    [-1.2, 44.8],
    [1.4, 44.1],
    [3.1, 43.9],
    [5.4, 43.3],
    [7.2, 43.7],
  ],
  [
    [2.9, 50.5],
    [2.35, 48.85],
    [3.08, 45.78],
    [3.88, 43.61],
  ],
];

type PayOption = { color: string; locoCount: number; colorCount: number };
type TtrRoute = (typeof TTR_ROUTES)[number];
type TtrDestination = (typeof TTR_DESTINATIONS)[number];
type ClaimedRoute = { id: string; ownerId?: string; paidColor?: string };

function projectGeo(lon: number, lat: number) {
  const width = 100 - FRANCE_BOUNDS.padX * 2;
  const height = 100 - FRANCE_BOUNDS.padY * 2;
  const x =
    FRANCE_BOUNDS.padX +
    ((lon - FRANCE_BOUNDS.minLon) / (FRANCE_BOUNDS.maxLon - FRANCE_BOUNDS.minLon)) * width;
  const y =
    FRANCE_BOUNDS.padY +
    ((FRANCE_BOUNDS.maxLat - lat) / (FRANCE_BOUNDS.maxLat - FRANCE_BOUNDS.minLat)) * height;
  return { x, y };
}

function geoPath(points: Array<[number, number]>, close = false) {
  return points
    .map(([lon, lat], index) => {
      const p = projectGeo(lon, lat);
      return `${index === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(' ') + (close ? ' Z' : '');
}

function cityPoint(cityId: string) {
  const geo = CITY_GEO[cityId];
  if (geo) return projectGeo(geo.lon, geo.lat);
  const fallback = TTR_CITIES.find((c) => c.id === cityId);
  return { x: fallback?.x ?? 50, y: fallback?.y ?? 50 };
}

const FRANCE_OUTLINE_PATH = geoPath(FRANCE_OUTLINE_GEO, true);
const FRANCE_REGION_PATHS = FRANCE_REGION_LINES.map((line) => geoPath(line));


function cityName(id: string) {
  return TTR_CITIES.find((c) => c.id === id)?.name ?? id;
}

function cardCount(hand: Record<string, number> | undefined) {
  if (!hand) return 0;
  return Object.values(hand).reduce((sum, n) => sum + n, 0);
}

function emitTtr(event: string, payload?: unknown, onOk?: () => void) {
  const socket = getSocket();
  const ack = (res: { ok: boolean; message?: string }) => {
    if (!res.ok) {
      mvpSound.fail();
      alert(res.message ?? 'Action impossible');
      return;
    }
    mvpSound.whoosh();
    onOk?.();
  };
  if (payload === undefined) (socket.emit as any)(event, ack);
  else (socket.emit as any)(event, payload, ack);
}

function buildPayOptions(
  route: TtrRoute,
  hand: Record<string, number>,
  trainsLeft: number,
  canBuild: boolean,
  alreadyClaimed: boolean,
): PayOption[] {
  if (!canBuild || alreadyClaimed || trainsLeft < route.length) return [];
  const locos = hand.loco ?? 0;
  const colors = route.color === 'gray' ? [...TTR_CARD_COLORS] : [route.color];
  const options: PayOption[] = [];
  const seen = new Set<string>();
  for (const color of colors) {
    const haveColor = hand[color] ?? 0;
    for (let locoCount = 0; locoCount <= Math.min(locos, route.length); locoCount++) {
      const colorCount = route.length - locoCount;
      if (haveColor < colorCount) continue;
      const key = `${color}:${locoCount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ color, locoCount, colorCount });
    }
  }
  if (route.color === 'gray' && locos >= route.length) {
    options.push({ color: 'loco', locoCount: route.length, colorCount: 0 });
  }
  return options.sort((a, b) => a.locoCount - b.locoCount || a.color.localeCompare(b.color));
}

export function TicketToRideRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const ttrPrivate = useGameStore((s) => s.ttrPrivate);
  const round = snapshot?.round;
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const pendingDrawKey = ttrPrivate?.pendingDraw?.join('|') ?? '';
  useEffect(() => {
    setSelectedTickets(new Set(ttrPrivate?.pendingDraw ?? []));
  }, [pendingDrawKey, ttrPrivate?.pendingIsInitial]);

  if (!snapshot || !round || round.mode !== 'ticket-to-ride') return null;

  const players = snapshot.players;
  const currentPlayerId = round.ttrCurrentPlayerId ?? round.currentPlayerId;
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isMyTurn = !!myId && currentPlayerId === myId;
  const sub = round.ttrSub;
  const turnAction = round.ttrTurnAction ?? { kind: 'idle' as const };
  const canTakeTurn = isMyTurn && (sub === 'playing' || sub === 'last-round');
  const canBuildRoute = canTakeTurn && turnAction.kind === 'idle';
  const myHand = ttrPrivate?.hand ?? {};
  const myTrains = myId ? (round.ttrTrains?.[myId] ?? 0) : 0;
  const pendingTickets = ttrPrivate?.pendingDraw ?? [];
  const minTicketKeep = ttrPrivate?.pendingIsInitial
    ? 2
    : turnAction.kind === 'picking-destinations'
      ? turnAction.minKeep
      : 1;

  const claimedById = useMemo(() => {
    const map = new Map<string, ClaimedRoute>();
    for (const route of round.ttrClaimedRoutes ?? []) map.set(route.id, route);
    return map;
  }, [round.ttrClaimedRoutes]);

  const destinationById = useMemo(() => {
    const map = new Map(TTR_DESTINATIONS.map((d) => [d.id, d]));
    return map;
  }, []);

  const payOptionsByRouteId = useMemo(() => {
    const map = new Map<string, PayOption[]>();
    for (const route of TTR_ROUTES) {
      map.set(
        route.id,
        buildPayOptions(route, myHand, myTrains, canBuildRoute, !!claimedById.get(route.id)?.ownerId),
      );
    }
    return map;
  }, [canBuildRoute, claimedById, myHand, myTrains]);

  const selectedRoute = selectedRouteId
    ? TTR_ROUTES.find((route) => route.id === selectedRouteId)
    : undefined;
  const selectedPayOptions = selectedRoute ? payOptionsByRouteId.get(selectedRoute.id) ?? [] : [];

  const drawDeck = () => emitTtr('ttr:drawFromDeck');
  const drawDestinations = () => emitTtr('ttr:drawDestinations');
  const drawMarket = (slot: number) => emitTtr('ttr:drawFromMarket', { slot });
  const claimRoute = (option: PayOption) => {
    if (!selectedRoute) return;
    emitTtr(
      'ttr:claimRoute',
      {
        routeId: selectedRoute.id,
        paidColor: option.color,
        locoCount: option.locoCount,
      },
      () => setSelectedRouteId(null),
    );
  };
  const keepTickets = () => {
    const kept = [...selectedTickets];
    const event = ttrPrivate?.pendingIsInitial
      ? 'ttr:confirmInitialDestinations'
      : 'ttr:keepDestinations';
    emitTtr(event, { kept });
  };

  const claimedCount = (round.ttrClaimedRoutes ?? []).filter((r) => r.ownerId).length;
  const deckAvailable = (round.ttrDeckSize ?? 0) + (round.ttrDiscardSize ?? 0) > 0;
  const actionStarted = turnAction.kind !== 'idle';
  const isPickingTickets = turnAction.kind === 'picking-destinations';
  const phaseLabel =
    sub === 'initial-destinations'
      ? 'Billets de départ'
      : sub === 'last-round'
        ? 'Dernier tour'
        : sub === 'done'
          ? 'Fin'
          : 'En route';
  const lastRoundPlayer = players.find((p) => p.id === round.ttrLastRoundTriggerId);

  return (
    <div className="ttr-game -mx-1 flex flex-col gap-4 sm:-mx-2">
      <section className="ttr-command-bar">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-amber-300">
            <Train className="h-5 w-5" />
            <h3 className="font-display text-xl font-bold sm:text-2xl">Aventuriers du Rail</h3>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {claimedCount}/{TTR_ROUTES.length} tronçons capturés · {round.ttrDeckSize ?? 0} cartes wagon ·{' '}
            {round.ttrDestinationDeckSize ?? 0} billets restants
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[420px]">
          <StatusTile icon={<MapIcon className="h-4 w-4" />} label="Phase" value={phaseLabel} />
          <StatusTile icon={<Ticket className="h-4 w-4" />} label="Tour" value={currentPlayer?.nickname ?? 'En attente'} />
          <StatusTile icon={<Trophy className="h-4 w-4" />} label="Wagons" value={`${myTrains}`} />
        </div>
      </section>

      {sub === 'last-round' && round.ttrLastRoundTriggerId && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.12)]">
          Dernière boucle déclenchée par <strong>{lastRoundPlayer?.nickname ?? 'un joueur'}</strong>.
        </div>
      )}

      {pendingTickets.length > 0 && (
        <TicketPicker
          destinationById={destinationById}
          minKeep={minTicketKeep}
          pendingIds={pendingTickets}
          selected={selectedTickets}
          setSelected={setSelectedTickets}
          onConfirm={keepTickets}
          initial={!!ttrPrivate?.pendingIsInitial}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col gap-4">
          <TtrBoardMap
            players={players}
            claimedById={claimedById}
            currentPlayerId={currentPlayerId}
            selectedRouteId={selectedRouteId}
            payableRouteIds={new Set(
              [...payOptionsByRouteId.entries()].filter(([, options]) => options.length > 0).map(([id]) => id),
            )}
            onSelectRoute={setSelectedRouteId}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)]">
            <HandPanel hand={myHand} />
            <DestinationPanel destinationById={destinationById} destinationIds={ttrPrivate?.destinations ?? []} />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <TtrActionPanel
            canTakeTurn={canTakeTurn}
            deckAvailable={deckAvailable}
            isPickingTickets={isPickingTickets}
            actionStarted={actionStarted}
            destinationDeckSize={round.ttrDestinationDeckSize ?? 0}
            turnAction={turnAction}
            isMyTurn={isMyTurn}
            currentPlayerName={currentPlayer?.nickname}
            market={round.ttrMarket ?? []}
            onDrawDeck={drawDeck}
            onDrawDestinations={drawDestinations}
            onDrawMarket={drawMarket}
          />

          <RoutePanel
            route={selectedRoute}
            ownerName={
              selectedRoute
                ? players.find((p) => p.id === claimedById.get(selectedRoute.id)?.ownerId)?.nickname
                : undefined
            }
            ownerColor={
              selectedRoute
                ? players.find((p) => p.id === claimedById.get(selectedRoute.id)?.ownerId)?.avatar.color
                : undefined
            }
            payOptions={selectedPayOptions}
            onPay={claimRoute}
          />

          <ScoreBoard players={players} round={round} currentPlayerId={currentPlayerId} />
        </aside>
      </div>
    </div>
  );
}

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 shadow-inner">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function TtrBoardMap({
  players,
  claimedById,
  currentPlayerId,
  selectedRouteId,
  payableRouteIds,
  onSelectRoute,
}: {
  players: NonNullable<ReturnType<typeof useGameStore.getState>['snapshot']>['players'];
  claimedById: Map<string, ClaimedRoute>;
  currentPlayerId?: string;
  selectedRouteId: string | null;
  payableRouteIds: Set<string>;
  onSelectRoute: (routeId: string) => void;
}) {
  return (
    <div className="ttr-board-shell">
      <div className="ttr-board-topline">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-amber-200/70">Plateau réseau</div>
          <div className="mt-1 text-sm font-semibold text-white">France express · réseau premium</div>
        </div>
        <div className="hidden text-right text-xs text-text-muted sm:block">Routes · villes · objectifs</div>
      </div>

      <div className="ttr-board-canvas">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Carte des tronçons Aventuriers du Rail">
          <defs>
            <radialGradient id="ttrSeaGlow" cx="52%" cy="48%" r="70%">
              <stop offset="0%" stopColor="#243653" />
              <stop offset="62%" stopColor="#101a2c" />
              <stop offset="100%" stopColor="#080c17" />
            </radialGradient>
            <linearGradient id="ttrLand" x1="12%" y1="4%" x2="88%" y2="96%">
              <stop offset="0%" stopColor="#26364c" />
              <stop offset="52%" stopColor="#1b2d3d" />
              <stop offset="100%" stopColor="#152238" />
            </linearGradient>
            <pattern id="ttrGrid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="0.18" />
            </pattern>
            <filter id="ttrSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.2" stdDeviation="1.5" floodColor="#020617" floodOpacity="0.55" />
            </filter>
            <filter id="ttrGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.1" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="100" height="100" fill="url(#ttrSeaGlow)" />
          <path
            d={FRANCE_OUTLINE_PATH}
            fill="url(#ttrLand)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="0.55"
            filter="url(#ttrSoftShadow)"
          />
          <rect width="100" height="100" fill="url(#ttrGrid)" opacity="0.55" />
          <path
            d={FRANCE_OUTLINE_PATH}
            fill="none"
            stroke="rgba(251,191,36,0.16)"
            strokeWidth="0.28"
            strokeDasharray="1.3 1.2"
            pointerEvents="none"
          />
          {FRANCE_REGION_PATHS.map((path, index) => (
            <path
              key={index}
              d={path}
              fill="none"
              stroke={index % 2 === 0 ? 'rgba(34,211,238,0.09)' : 'rgba(251,191,36,0.08)'}
              strokeWidth="0.55"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ))}
          <text
            x="12"
            y="91"
            fill="rgba(255,255,255,0.16)"
            fontSize="2.4"
            fontWeight={800}
            letterSpacing="0.18em"
            className="pointer-events-none select-none"
          >
            FRANCE
          </text>

          {TTR_ROUTES.map((route) => {
            const claimed = claimedById.get(route.id);
            const owner = players.find((p) => p.id === claimed?.ownerId);
            return (
              <TtrRouteSegment
                key={route.id}
                route={route}
                claimed={claimed}
                ownerColor={owner?.avatar.color}
                isCurrentOwner={claimed?.ownerId === currentPlayerId}
                selected={route.id === selectedRouteId}
                payable={payableRouteIds.has(route.id)}
                onSelect={onSelectRoute}
              />
            );
          })}

          {TTR_CITIES.map((city) => (
            <TtrCityMarker key={city.id} city={city} />
          ))}

          <rect
            x="0.5"
            y="0.5"
            width="99"
            height="99"
            rx="3.5"
            fill="none"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="0.5"
            pointerEvents="none"
          />
        </svg>
      </div>
    </div>
  );
}

function TtrRouteSegment({
  route,
  claimed,
  ownerColor,
  isCurrentOwner,
  selected,
  payable,
  onSelect,
}: {
  route: TtrRoute;
  claimed?: ClaimedRoute;
  ownerColor?: string;
  isCurrentOwner: boolean;
  selected: boolean;
  payable: boolean;
  onSelect: (routeId: string) => void;
}) {
  const a = cityPoint(route.cityA);
  const b = cityPoint(route.cityB);

  const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
  const routeMeta = CARD_META[claimed?.paidColor ?? route.color] ?? CARD_META.gray;
  const fill = claimed?.ownerId ? ownerColor ?? '#f59e0b' : routeMeta.fill;
  const glow = claimed?.ownerId ? ownerColor ?? '#f59e0b' : routeMeta.shadow;
  const underlay = selected ? '#fbbf24' : payable ? '#22d3ee' : 'rgba(2,6,23,0.92)';
  const underlayWidth = selected ? 4.1 : payable ? 3.55 : 3.05;

  return (
    <g onClick={() => onSelect(route.id)} className="group cursor-pointer">
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={underlay}
        strokeWidth={underlayWidth}
        strokeLinecap="round"
        opacity={selected || payable ? 0.85 : 0.72}
        filter={selected || payable || claimed?.ownerId ? 'url(#ttrGlow)' : undefined}
      />
      {(selected || payable) && (
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={selected ? '#fbbf24' : '#22d3ee'}
          strokeWidth={selected ? 5.6 : 4.5}
          strokeLinecap="round"
          strokeOpacity={selected ? 0.18 : 0.12}
          filter="url(#ttrGlow)"
        />
      )}
      {Array.from({ length: route.length }).map((_, i) => {
        const t = (i + 1) / (route.length + 1);
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        return (
          <g key={`${route.id}-${i}`} transform={`rotate(${angle} ${x} ${y})`}>
            <rect
              x={x - 1.85}
              y={y - 0.86}
              width={3.7}
              height={1.72}
              rx={0.42}
              fill={fill}
              opacity={claimed?.ownerId ? 0.98 : 0.9}
              stroke={selected ? '#fef3c7' : claimed?.ownerId ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.54)'}
              strokeWidth={selected ? 0.3 : 0.18}
              style={{ filter: `drop-shadow(0 0 ${selected || payable ? 2.1 : 0.8}px ${glow})` }}
            />
            <line
              x1={x - 1.05}
              y1={y}
              x2={x + 1.05}
              y2={y}
              stroke={routeMeta.text}
              strokeOpacity={claimed?.ownerId ? 0.28 : 0.2}
              strokeWidth={0.22}
            />
          </g>
        );
      })}
      {isCurrentOwner && (
        <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r="1.4" fill="#fbbf24" stroke="#fff7ed" strokeWidth="0.25" />
      )}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={7} />
    </g>
  );
}

function TtrCityMarker({ city }: { city: (typeof TTR_CITIES)[number] }) {
  const label = CITY_LABEL_OFFSETS[city.id] ?? { x: 0, y: -4, anchor: 'middle' as const };
  const point = cityPoint(city.id);
  const fontSize = city.id === 'clermont' ? 1.55 : 1.72;
  const labelWidth = Math.max(7.2, city.name.length * fontSize * 0.72 + 1.7);
  const labelX =
    label.anchor === 'start'
      ? label.x - 0.8
      : label.anchor === 'end'
        ? label.x - labelWidth + 0.8
        : label.x - labelWidth / 2;
  return (
    <g transform={`translate(${point.x}, ${point.y})`}>
      <circle r={2.25} fill="rgba(251,191,36,0.16)" filter="url(#ttrGlow)" />
      <circle r={1.28} fill="#0f172a" stroke="#fde68a" strokeWidth={0.38} />
      <circle r={0.46} fill="#fbbf24" />
      <rect
        x={labelX}
        y={label.y - 2.38}
        width={labelWidth}
        height={3.1}
        rx={0.82}
        fill="rgba(2,6,23,0.72)"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth={0.16}
        className="pointer-events-none"
      />
      <text
        x={label.x}
        y={label.y}
        textAnchor={label.anchor ?? 'middle'}
        fill="rgba(255,255,255,0.92)"
        fontSize={fontSize}
        fontWeight={800}
        paintOrder="stroke"
        stroke="rgba(2,6,23,0.72)"
        strokeWidth={0.28}
        className="pointer-events-none select-none"
      >
        {city.name}
      </text>
    </g>
  );
}

function TtrTrainCard({
  card,
  disabled,
  compact = false,
  count,
  onClick,
}: {
  card: string | null;
  disabled?: boolean;
  compact?: boolean;
  count?: number;
  onClick?: () => void;
}) {
  const meta = CARD_META[card ?? 'gray'];
  const content = card === 'loco' ? 'Loco' : card ? meta.label : 'Vide';
  const inner = (
    <>
      <span className="ttr-train-card__rail" />
      <span className="ttr-train-card__label">{content}</span>
      {typeof count === 'number' && <span className="ttr-train-card__count">{count}</span>}
    </>
  );
  const style = {
    ['--card-fill' as string]: meta.fill,
    ['--card-soft' as string]: meta.soft,
    ['--card-text' as string]: meta.text,
    ['--card-shadow' as string]: meta.shadow,
  };

  if (!onClick) {
    return (
      <div
        className={`ttr-train-card ${compact ? 'ttr-train-card--compact' : ''}`}
        style={style}
        title={card ? meta.label : 'Vide'}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || !card}
      onClick={onClick}
      className={`ttr-train-card ${compact ? 'ttr-train-card--compact' : ''}`}
      style={style}
      title={card ? meta.label : 'Vide'}
    >
      {inner}
    </button>
  );
}

function TtrDestinationCard({
  destination,
  selected,
  interactive,
  onToggle,
}: {
  destination: TtrDestination;
  selected?: boolean;
  interactive?: boolean;
  onToggle?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200/70">Billet</div>
          <div className="mt-1 text-sm font-bold leading-tight text-white">
            {cityName(destination.cityA)} → {cityName(destination.cityB)}
          </div>
        </div>
        <div className="rounded-lg border border-amber-200/30 bg-amber-300/15 px-2 py-1 font-mono text-sm font-bold text-amber-200">
          {destination.points}
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-amber-300/80 via-cyan-200/60 to-fuchsia-300/70" />
      {selected && (
        <CheckCircle2 className="absolute bottom-2 right-2 h-4 w-4 text-emerald-300" aria-hidden />
      )}
    </>
  );

  if (!interactive) {
    return <div className="ttr-destination-card">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ttr-destination-card text-left ${selected ? 'ttr-destination-card--selected' : ''}`}
    >
      {body}
    </button>
  );
}

function TtrActionPanel({
  canTakeTurn,
  deckAvailable,
  isPickingTickets,
  actionStarted,
  destinationDeckSize,
  turnAction,
  isMyTurn,
  currentPlayerName,
  market,
  onDrawDeck,
  onDrawDestinations,
  onDrawMarket,
}: {
  canTakeTurn: boolean;
  deckAvailable: boolean;
  isPickingTickets: boolean;
  actionStarted: boolean;
  destinationDeckSize: number;
  turnAction: { kind: 'idle' } | { kind: 'drew-one'; tookLoco: boolean } | { kind: 'picking-destinations'; minKeep: number };
  isMyTurn: boolean;
  currentPlayerName?: string;
  market: Array<string | null>;
  onDrawDeck: () => void;
  onDrawDestinations: () => void;
  onDrawMarket: (slot: number) => void;
}) {
  return (
    <div className="ttr-side-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Commandes</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {isMyTurn ? 'A toi de jouer' : `${currentPlayerName ?? 'Un joueur'} réfléchit`}
          </div>
        </div>
        {isMyTurn && <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-xs font-bold text-emerald-200">Actif</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canTakeTurn || isPickingTickets || !deckAvailable}
          onClick={onDrawDeck}
          className="btn-primary min-h-[48px] justify-center disabled:opacity-40"
        >
          Piocher
        </button>
        <button
          type="button"
          disabled={!canTakeTurn || actionStarted || destinationDeckSize <= 0}
          onClick={onDrawDestinations}
          className="btn-ghost min-h-[48px] justify-center disabled:opacity-40"
        >
          Billets
        </button>
      </div>

      {turnAction.kind === 'drew-one' && isMyTurn && (
        <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
          Tu peux encore prendre une carte, sauf une locomotive visible.
        </div>
      )}
      {isPickingTickets && isMyTurn && (
        <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          Choisis les billets à conserver pour terminer ton action.
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Marché ouvert</div>
          <div className="text-xs text-text-dim">5 cartes</div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {market.map((card, slot) => {
            const disabled =
              !card ||
              !canTakeTurn ||
              isPickingTickets ||
              (turnAction.kind === 'drew-one' && card === 'loco');
            return (
              <TtrTrainCard
                key={slot}
                card={card}
                disabled={disabled}
                compact
                onClick={() => onDrawMarket(slot)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HandPanel({ hand }: { hand: Record<string, number> }) {
  return (
    <div className="ttr-bottom-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Ma main</div>
          <div className="text-sm font-semibold text-white">{cardCount(hand)} cartes wagon</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {[...TTR_CARD_COLORS, 'loco'].map((color) => (
          <TtrTrainCard key={color} card={color} count={hand[color] ?? 0} compact />
        ))}
      </div>
    </div>
  );
}

function DestinationPanel({
  destinationById,
  destinationIds,
}: {
  destinationById: Map<string, TtrDestination>;
  destinationIds: string[];
}) {
  return (
    <div className="ttr-bottom-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Billets gardés</div>
          <div className="text-sm font-semibold text-white">{destinationIds.length} objectif(s)</div>
        </div>
      </div>
      <div className="grid max-h-[220px] gap-2 overflow-y-auto pr-1">
        {destinationIds.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-text-muted">
            Aucun billet confirmé.
          </div>
        )}
        {destinationIds.map((id) => {
          const destination = destinationById.get(id);
          if (!destination) return null;
          return <TtrDestinationCard key={id} destination={destination} />;
        })}
      </div>
    </div>
  );
}

function TicketPicker({
  destinationById,
  pendingIds,
  minKeep,
  selected,
  setSelected,
  onConfirm,
  initial,
}: {
  destinationById: Map<string, TtrDestination>;
  pendingIds: string[];
  minKeep: number;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  onConfirm: () => void;
  initial: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ttr-ticket-picker"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-300">
          <Ticket className="h-4 w-4" />
          <span className="font-semibold">{initial ? 'Billets de départ' : 'Nouveaux billets'}</span>
        </div>
        <div className="text-xs text-text-muted">Garder au moins {minKeep}</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {pendingIds.map((id) => {
          const destination = destinationById.get(id);
          if (!destination) return null;
          const checked = selected.has(id);
          return (
            <TtrDestinationCard
              key={id}
              destination={destination}
              selected={checked}
              interactive
              onToggle={() => {
                const next = new Set(selected);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setSelected(next);
              }}
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={selected.size < minKeep}
        onClick={onConfirm}
        className="btn-primary mt-3 min-h-[48px] justify-center disabled:opacity-40"
      >
        Confirmer les billets
      </button>
    </motion.div>
  );
}

function RoutePanel({
  route,
  ownerName,
  ownerColor,
  payOptions,
  onPay,
}: {
  route: TtrRoute | undefined;
  ownerName?: string;
  ownerColor?: string;
  payOptions: PayOption[];
  onPay: (option: PayOption) => void;
}) {
  if (!route) {
    return (
      <div className="ttr-side-panel min-h-[150px] justify-center">
        <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Tronçon</div>
        <div className="mt-2 text-sm text-text-muted">Aucun tronçon actif.</div>
      </div>
    );
  }
  const meta = CARD_META[route.color];
  return (
    <div className="ttr-side-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Tronçon sélectionné</div>
          <div className="mt-1 text-lg font-bold leading-tight text-white">
            {cityName(route.cityA)} → {cityName(route.cityB)}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200/25 bg-amber-300/15 px-3 py-2 text-center">
          <div className="font-mono text-lg font-black text-amber-200">{TTR_ROUTE_POINTS[route.length]}</div>
          <div className="text-[9px] uppercase tracking-wider text-amber-100/70">pts</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-text-muted">
          {route.length} wagons
        </span>
        <span
          className="rounded-full border px-2 py-1 font-semibold"
          style={{ borderColor: meta.shadow, background: meta.soft, color: meta.fill }}
        >
          {meta.label}
        </span>
      </div>

      {ownerName ? (
        <div
          className="mt-4 rounded-xl border px-3 py-3 text-sm font-semibold text-white"
          style={{
            borderColor: ownerColor ?? 'rgba(255,255,255,0.18)',
            background: `${ownerColor ?? '#f59e0b'}22`,
          }}
        >
          Pris par {ownerName}
        </div>
      ) : payOptions.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {payOptions.map((option) => (
            <PaymentOption key={`${option.color}-${option.locoCount}`} option={option} onPay={onPay} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-text-muted">
          Pas constructible avec ta main actuelle ou pas disponible pendant cette action.
        </div>
      )}
    </div>
  );
}

function PaymentOption({
  option,
  onPay,
}: {
  option: PayOption;
  onPay: (option: PayOption) => void;
}) {
  return (
    <button type="button" onClick={() => onPay(option)} className="ttr-payment-option">
      <span className="flex min-w-0 items-center gap-2">
        {option.colorCount > 0 && <MiniCard color={option.color} count={option.colorCount} />}
        {option.locoCount > 0 && <MiniCard color="loco" count={option.locoCount} />}
      </span>
      <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-amber-200">Construire</span>
    </button>
  );
}

function MiniCard({ color, count }: { color: string; count: number }) {
  const meta = CARD_META[color];
  return (
    <span
      className="inline-flex h-9 min-w-10 items-center justify-center rounded-lg border px-2 font-mono text-sm font-black"
      style={{
        background: meta.fill,
        color: meta.text,
        borderColor: 'rgba(255,255,255,0.3)',
        boxShadow: `0 0 16px ${meta.shadow}`,
      }}
    >
      {count}
    </span>
  );
}

function ScoreBoard({
  players,
  round,
  currentPlayerId,
}: {
  players: NonNullable<ReturnType<typeof useGameStore.getState>['snapshot']>['players'];
  round: NonNullable<NonNullable<ReturnType<typeof useGameStore.getState>['snapshot']>['round']>;
  currentPlayerId?: string;
}) {
  const ranked = [...players].sort(
    (a, b) => (round.ttrScoreFromRoutes?.[b.id] ?? 0) - (round.ttrScoreFromRoutes?.[a.id] ?? 0),
  );
  return (
    <div className="ttr-side-panel">
      <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-text-muted">Table</div>
      <div className="flex flex-col gap-2">
        {ranked.map((p, index) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
              p.id === currentPlayerId
                ? 'border-amber-300/50 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                : 'border-white/10 bg-white/[0.035]'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-5 text-xs tabular-nums text-text-muted">#{index + 1}</span>
              <AvatarBadge avatar={p.avatar} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{p.nickname}</div>
                <div className="truncate text-[11px] text-text-muted">
                  {round.ttrTrains?.[p.id] ?? 0} wagons · {round.ttrHandCounts?.[p.id] ?? 0} cartes ·{' '}
                  {round.ttrDestinationCounts?.[p.id] ?? 0} billets
                </div>
              </div>
            </div>
            <div className="font-mono text-sm font-bold text-amber-300">
              {round.ttrScoreFromRoutes?.[p.id] ?? 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
