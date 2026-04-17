'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { Check, MapPin, Send } from 'lucide-react';

const MapPickerLazy = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-2xl bg-surface-2 animate-pulse flex items-center justify-center text-text-dim">
      Chargement de la carte…
    </div>
  ),
});

export function MapRound() {
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) => (myId ? s.answeredPlayerIds.has(myId) : false));
  const questionId = useGameStore((s) => s.snapshot?.round?.question.id);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const send = () => {
    if (!coords || submitted) return;
    setSubmitted(true);
    const socket = getSocket();
    socket.emit('round:answer', { lat: coords.lat, lng: coords.lng }, (res) => {
      if (!res.ok) {
        setSubmitted(false);
        alert(res.message);
      }
    });
  };

  const done = submitted || alreadyAnswered;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-accent-cyan text-sm">
        <MapPin className="w-4 h-4" />
        Clique sur la carte pour placer ton marqueur.
      </div>
      <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
        <MapPickerLazy
          resetKey={questionId}
          value={coords}
          onChange={setCoords}
          readOnly={done}
        />
      </div>
      {coords && (
        <div className="text-xs text-text-muted">
          Position sélectionnée : {coords.lat.toFixed(2)}, {coords.lng.toFixed(2)}
        </div>
      )}
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={done || !coords}
        onClick={send}
        className="btn-primary w-full disabled:opacity-60"
      >
        {done ? (
          <>
            <Check className="w-5 h-5" /> Position envoyée
          </>
        ) : (
          <>
            <Send className="w-5 h-5" /> Valider la position
          </>
        )}
      </motion.button>
    </div>
  );
}
