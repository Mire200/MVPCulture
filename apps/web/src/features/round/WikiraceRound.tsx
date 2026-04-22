'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';
import { ArrowLeft, ChevronRight, Flag, Loader2, Target, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/** Extract wiki title from an href like `./Foo_Bar` or `/wiki/Foo_Bar`. */
function extractWikiTitle(href: string): string | null {
  // Wikipedia REST API renders internal links as `./Title`
  const dotSlash = href.match(/^\.\/([^#?]+)/);
  if (dotSlash) return decodeURIComponent(dotSlash[1]!).replace(/_/g, ' ');

  const wikiSlash = href.match(/\/wiki\/([^#?]+)/);
  if (wikiSlash) return decodeURIComponent(wikiSlash[1]!).replace(/_/g, ' ');

  return null;
}

/**
 * Sanitize Wikipedia REST HTML for safe in-app rendering.
 * - Transforms internal wiki links to `data-wiki-title` attributes
 * - Removes edit/ref/navbox sections
 * - Makes image URLs absolute
 */
function sanitizeWikiHtml(html: string, lang: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove non-content elements
  const removeSelectors = [
    'script', 'style', 'link[rel="stylesheet"]',
    '.mw-editsection', '.mw-ref', '.reference',
    '.mw-references-wrap', '.reflist', '.refbegin',
    '.navbox', '.catlinks', '.metadata',
    '.sistersitebox', '.noprint', '.mw-empty-elt',
    '[role="navigation"]', '.mw-heading .mw-editsection',
    '.mw-parser-output > .hatnote',
  ];
  for (const sel of removeSelectors) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }

  // Transform internal links
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const title = extractWikiTitle(href);
    if (title) {
      a.setAttribute('data-wiki-title', title);
      a.removeAttribute('href');
      a.setAttribute('role', 'button');
      a.setAttribute('tabindex', '0');
    } else if (href.startsWith('#')) {
      // Anchor links — keep but make them no-op externally
      a.removeAttribute('href');
    } else {
      // External links: keep href but disable interaction via CSS
      a.removeAttribute('target');
    }
  });

  // Make image src absolute
  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('//')) {
      img.setAttribute('src', 'https:' + src);
    } else if (src.startsWith('/')) {
      img.setAttribute('src', `https://${lang}.wikipedia.org${src}`);
    }
  });

  // Remove srcset (avoid lazy-loading issues)
  doc.querySelectorAll('img[srcset]').forEach((img) => img.removeAttribute('srcset'));

  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WikiraceRound() {
  const round = useGameStore((s) => s.snapshot?.round);
  const myId = useGameStore((s) => s.playerId);

  const me = myId ? round?.wrPlayers?.[myId] : undefined;
  const startTitle = round?.wrStartTitle ?? '';
  const targetTitle = round?.wrTargetTitle ?? '';
  const wikiLang = round?.wrWikiLang ?? 'fr';
  const isDone = me ? me.status !== 'running' : false;

  // Local navigation state — separate from server path
  const [currentTitle, setCurrentTitle] = useState(startTitle);
  const [wikiHtml, setWikiHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string[]>([startTitle]);

  const frameRef = useRef<HTMLDivElement>(null);

  // Reset when round changes
  useEffect(() => {
    if (startTitle) {
      setCurrentTitle(startTitle);
      setLocalPath([startTitle]);
      setWikiHtml(null);
      setError(null);
    }
  }, [startTitle]);

  // Fetch Wikipedia page HTML
  const fetchPage = useCallback(
    async (title: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/wiki?lang=${encodeURIComponent(wikiLang)}&title=${encodeURIComponent(title)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Erreur ${res.status}`);
        }
        const data = await res.json();
        const sanitized = sanitizeWikiHtml(data.html, wikiLang);
        setWikiHtml(sanitized);
        setCurrentTitle(title);
        // Scroll frame to top
        frameRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [wikiLang],
  );

  // Load initial page
  useEffect(() => {
    if (startTitle && !wikiHtml && !loading) {
      fetchPage(startTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTitle]);

  // Navigate to a wiki page
  const navigateTo = useCallback(
    (title: string) => {
      if (isDone || loading) return;

      // Emit socket navigate
      const sock = getSocket();
      sock.emit('wikirace:navigate', { title }, (res) => {
        if (!res.ok) {
          console.warn('[WikiRace] navigate rejected:', res.message);
        }
      });

      // Update local path
      setLocalPath((prev) => [...prev, title]);

      // Fetch the page content
      fetchPage(title);
    },
    [isDone, loading, fetchPage],
  );

  // Go back in local path (visual only — no server event, just re-view a past page)
  const goBack = useCallback(() => {
    if (localPath.length <= 1 || loading) return;
    const prevPath = localPath.slice(0, -1);
    const prevTitle = prevPath[prevPath.length - 1]!;
    setLocalPath(prevPath);
    fetchPage(prevTitle);
  }, [localPath, loading, fetchPage]);

  // Handle clicks within wiki content
  const handleWikiClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[data-wiki-title]');
      if (!target) return;
      e.preventDefault();
      const title = target.getAttribute('data-wiki-title');
      if (title) navigateTo(title);
    },
    [navigateTo],
  );

  // Handle keyboard (Enter) on wiki links
  const handleWikiKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = (e.target as HTMLElement).closest('a[data-wiki-title]');
      if (!target) return;
      const title = target.getAttribute('data-wiki-title');
      if (title) navigateTo(title);
    },
    [navigateTo],
  );

  const abandon = () => {
    if (isDone) return;
    const sock = getSocket();
    sock.emit('wikirace:abandon', (res) => {
      if (!res.ok) alert(res.message);
    });
  };

  const isTargetReached = normalizeWikiTitle(currentTitle) === normalizeWikiTitle(targetTitle);

  return (
    <div className="space-y-4">
      {/* Objective bar */}
      <div className="panel p-4 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Target className="w-4 h-4 text-neon-lime" />
            <span>Cible :</span>
            <span className="text-neon-lime font-semibold">{targetTitle}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-text-dim">
              Sauts : <span className="text-text font-semibold">{me?.hops ?? 0}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`panel p-4 text-sm ${
              me?.status === 'finished'
                ? 'border-[rgba(163,230,53,0.4)]'
                : 'border-[rgba(244,63,94,0.4)]'
            }`}
          >
            {me?.status === 'finished' ? (
              <div className="flex items-center gap-2 text-neon-lime">
                <Trophy className="w-5 h-5" />
                Bravo ! Tu as atteint la cible en {me.hops} sauts. En attente des autres joueurs…
              </div>
            ) : (
              <div className="text-neon-rose">
                Tu as quitté la course. En attente de la révélation.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wiki browser */}
      <div>
        {/* Nav bar */}
        <div className="wr-nav">
          <button
            type="button"
            className="wr-nav-btn"
            onClick={goBack}
            disabled={localPath.length <= 1 || loading}
            title="Page précédente"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="wr-nav-title">{currentTitle}</div>
          {loading && <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />}
        </div>

        {/* Content frame */}
        <div
          ref={frameRef}
          className="wr-frame"
          onClick={isDone ? undefined : handleWikiClick}
          onKeyDown={isDone ? undefined : handleWikiKeyDown}
        >
          {loading && !wikiHtml && (
            <div className="wr-loading">
              <div className="wr-spinner" />
              <span>Chargement de la page…</span>
            </div>
          )}
          {error && (
            <div className="wr-loading">
              <span className="text-neon-rose">Erreur : {error}</span>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => fetchPage(currentTitle)}
              >
                Réessayer
              </button>
            </div>
          )}
          {wikiHtml && (
            <div
              className="wiki-content"
              dangerouslySetInnerHTML={{ __html: wikiHtml }}
              style={isDone ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
            />
          )}
        </div>
      </div>

      {/* Path breadcrumbs */}
      {localPath.length > 1 && (
        <div className="wr-path">
          {localPath.map((title, i) => (
            <span key={`${i}-${title}`} className="contents">
              {i > 0 && <ChevronRight className="wr-path-arrow w-3 h-3" />}
              <span
                className={`wr-path-chip ${i === localPath.length - 1 ? 'active' : ''}`}
              >
                {title}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Abandon + Progression */}
      <div className="flex flex-col sm:flex-row gap-4">
        {!isDone && (
          <button
            type="button"
            onClick={abandon}
            className="btn-ghost text-neon-rose"
          >
            <Flag className="w-4 h-4" />
            Abandonner
          </button>
        )}
        <div className="panel p-4 flex-1">
          <div className="text-xs text-text-dim uppercase tracking-wider mb-2">
            Progression
          </div>
          <div className="space-y-1.5">
            {Object.entries(round?.wrPlayers ?? {}).map(([pid, p]) => {
              const player = (
                useGameStore.getState().snapshot?.players ?? []
              ).find((x) => x.id === pid);
              const done = p.status !== 'running';
              return (
                <div
                  key={pid}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={pid === myId ? 'text-neon-cyan' : 'text-text'}
                  >
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
    </div>
  );
}
