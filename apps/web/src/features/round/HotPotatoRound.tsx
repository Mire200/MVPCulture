'use client';
import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Send, Target, Check, X } from 'lucide-react';

export function HotPotatoRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const round = snapshot?.round;
  const q = round?.question;

  const [bid, setBid] = useState<number>(3);
  const [bidSent, setBidSent] = useState(false);
  const [item, setItem] = useState('');
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const [localItems, setLocalItems] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const phase = round?.hpPhase;
  const myProgress = myId ? round?.hpProgress?.[myId] : undefined;
  const myBid = myProgress?.bid;
  const myCount = myProgress?.count ?? 0;
  const maxBid = q?.maxBid ?? 10;

  useEffect(() => {
    if (phase === 'answer' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  useEffect(() => {
    if (myBid !== undefined && !bidSent) setBidSent(true);
  }, [myBid, bidSent]);

  const sendBid = () => {
    if (bidSent) return;
    const socket = getSocket();
    setBidSent(true);
    socket.emit('round:answer', { bid }, (res) => {
      if (!res.ok) {
        setBidSent(false);
        alert(res.message);
      }
    });
  };

  const sendItem = (e: React.FormEvent) => {
    e.preventDefault();
    const value = item.trim();
    if (!value) return;
    const socket = getSocket();
    const prevCount = myCount;
    socket.emit('round:answer', { listItem: value }, (res) => {
      if (!res.ok) {
        setFlash('bad');
      } else {
        // Après ack, si le count a avancé, c'est que l'item a été accepté.
        setTimeout(() => {
          const s = useGameStore.getState().snapshot;
          const now = myId ? s?.round?.hpProgress?.[myId]?.count ?? 0 : 0;
          if (now > prevCount) {
            setFlash('ok');
            setLocalItems((l) => [...l, value]);
          } else {
            setFlash('bad');
          }
        }, 80);
      }
      setItem('');
      setTimeout(() => setFlash(null), 500);
    });
  };

  if (!q || !round) return null;

  if (phase === 'bid') {
    return (
      <div className="panel p-6 space-y-6">
        <div className="flex items-center gap-2 text-accent-amber">
          <Flame className="w-5 h-5" />
          <span className="font-semibold">Combien tu peux en citer ?</span>
        </div>
        <p className="text-text-muted">
          Annonce ton objectif. Plus tu bides, plus tu peux marquer — mais rate et tu perds gros.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setBid((b) => Math.max(1, b - 1))}
            disabled={bidSent}
            className="w-14 h-14 rounded-2xl bg-surface-2 hover:bg-surface-3 text-3xl font-bold disabled:opacity-40"
          >
            −
          </button>
          <motion.div
            key={bid}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            className="w-28 h-28 rounded-3xl bg-gradient-to-br from-accent-amber/30 to-accent-magenta/30 ring-2 ring-accent-amber/50 flex items-center justify-center text-5xl font-display"
          >
            {bid}
          </motion.div>
          <button
            type="button"
            onClick={() => setBid((b) => Math.min(maxBid, b + 1))}
            disabled={bidSent}
            className="w-14 h-14 rounded-2xl bg-surface-2 hover:bg-surface-3 text-3xl font-bold disabled:opacity-40"
          >
            +
          </button>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={bidSent}
          onClick={sendBid}
          className="btn-primary w-full disabled:opacity-60"
        >
          {bidSent ? (
            <>
              <Check className="w-5 h-5" />
              Mise enregistrée — en attente des autres
            </>
          ) : (
            <>
              <Target className="w-5 h-5" />
              Je mise {bid}
            </>
          )}
        </motion.button>
      </div>
    );
  }

  if (phase === 'answer') {
    const progress = myBid ? Math.min(1, myCount / myBid) : 0;
    const done = myProgress?.done;
    return (
      <div className="panel p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-text-muted">Ton objectif</div>
          <div className="font-display text-2xl">
            <span className={done && myBid && myCount >= myBid ? 'text-accent-lime' : ''}>
              {myCount}
            </span>
            <span className="text-text-dim"> / {myBid ?? '?'}</span>
          </div>
        </div>
        <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-amber to-accent-magenta"
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <form onSubmit={sendItem} className="flex gap-2">
          <input
            ref={inputRef}
            value={item}
            onChange={(e) => setItem(e.target.value)}
            disabled={done}
            placeholder="Cite un élément…"
            className="input flex-1 text-lg"
            maxLength={80}
          />
          <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={done} className="btn-primary">
            <Send className="w-4 h-4" />
            Valider
          </motion.button>
        </form>
        <AnimatePresence>
          {flash === 'ok' && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-accent-lime flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Validé !
            </motion.div>
          )}
          {flash === 'bad' && (
            <motion.div
              key="bad"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-accent-rose flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Refusé (doublon ou inconnu)
            </motion.div>
          )}
        </AnimatePresence>
        {localItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {localItems.map((it, i) => (
              <motion.span
                key={`${it}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-2.5 py-1 rounded-full bg-surface-2 text-xs"
              >
                {it}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <p className="text-text-muted">En attente…</p>
    </div>
  );
}
