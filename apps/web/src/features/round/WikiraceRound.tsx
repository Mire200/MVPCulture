'use client';
import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';
import { ExternalLink, Flag, Navigation } from 'lucide-react';

function normalizeWikiTitle(raw: string): string {
  try {
    return decodeURIComponent(raw)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch {
    return raw.replace(/_/g, ' ').trim().toLowerCase();
  }
}

export function WikiraceRound() {
  const round = useGameStore((s) => s.snapshot?.round);
  const myId = useGameStore((s) => s.playerId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const me = myId ? round?.wrPlayers?.[myId] : undefined;
  const startTitle = round?.wrStartTitle ?? '';
  const targetTitle = round?.wrTargetTitle ?? '';
  const wikiLang = round?.wrWikiLang ?? 'fr';
  const isDone = me ? me.status !== 'running' : false;

  const wikiUrl = useMemo(() => {
    if (!startTitle) return '';
    return `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(startTitle.replace(/ /g, '_'))}`;
  }, [wikiLang, startTitle]);

  const submitNavigate = () => {
    if (!input.trim() || sending || isDone) return;
    const title = input.trim();
    setSending(true);
    const sock = getSocket();
    sock.emit('wikirace:navigate', { title }, (res) => {
      setSending(false);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      setInput('');
    });
  };

  const abandon = () => {
    if (sending || isDone) return;
    const sock = getSocket();
    sock.emit('wikirace:abandon', (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  return (
    <div className="space-y-4">
      <div className="panel p-5 space-y-2">
        <div className="text-xs text-text-dim uppercase tracking-wider">Objectif</div>
        <div className="text-sm text-text-muted">
          Départ: <span className="text-text font-semibold">{startTitle}</span>
        </div>
        <div className="text-sm text-text-muted">
          Cible: <span className="text-neon-lime font-semibold">{targetTitle}</span>
        </div>
        <div className="text-sm text-text-muted">
          Tes sauts: <span className="font-semibold text-text">{me?.hops ?? 0}</span>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Navigation className="w-4 h-4" />
          Clique les liens sur Wikipédia, puis colle le titre de la page où tu arrives.
        </div>
        <a
          href={wikiUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary inline-flex"
        >
          <ExternalLink className="w-4 h-4" />
          Ouvrir la page de départ
        </a>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNavigate();
            }}
            disabled={isDone}
            placeholder="Titre de la page actuelle"
            className="flex-1 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-neon-cyan"
          />
          <button
            type="button"
            onClick={submitNavigate}
            disabled={isDone || sending || !input.trim()}
            className="btn-primary disabled:opacity-50"
          >
            Valider
          </button>
        </div>
        {!isDone && (
          <button type="button" onClick={abandon} className="btn-ghost text-neon-rose">
            <Flag className="w-4 h-4" />
            Abandonner
          </button>
        )}
        {isDone && (
          <div className="text-sm text-neon-lime">
            {me?.status === 'finished'
              ? 'Arrivé ! En attente des autres joueurs.'
              : 'Tu as quitté la course. En attente de la révélation.'}
          </div>
        )}
      </div>

      <div className="panel p-4">
        <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Progression</div>
        <div className="space-y-1.5">
          {Object.entries(round?.wrPlayers ?? {}).map(([pid, p]) => {
            const player = (useGameStore.getState().snapshot?.players ?? []).find((x) => x.id === pid);
            const done = p.status !== 'running';
            return (
              <div key={pid} className="flex items-center justify-between text-sm">
                <span className={pid === myId ? 'text-neon-cyan' : 'text-text'}>
                  {player?.nickname ?? 'Joueur'}
                </span>
                <span className={done ? 'text-text-muted' : 'text-neon-lime'}>
                  {p.hops} sauts · {p.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
