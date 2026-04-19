'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { Check, Send } from 'lucide-react';

const MapPickerLazy = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="mvpc-map-fullbleed bg-surface-2 animate-pulse flex items-center justify-center text-text-dim">
      Chargement de la carte…
    </div>
  ),
});

export function MapRound() {
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) => (myId ? s.answeredPlayerIds.has(myId) : false));
  const questionId = useGameStore((s) => s.snapshot?.round?.question.id);
  const myColor = useGameStore((s) => {
    const p = s.snapshot?.players.find((pl) => pl.id === s.playerId);
    return p?.avatar.color;
  });
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
    <div className="space-y-3">
      <div className="mvpc-map-fullbleed relative rounded-3xl overflow-hidden ring-1 ring-white/10">
        <MapPickerLazy
          resetKey={questionId}
          value={coords}
          onChange={setCoords}
          readOnly={done}
          color={myColor}
          fill
        />
        {coords && (
          <div className="absolute left-3 top-3 z-10 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-sm ring-1 ring-white/10 font-mono text-[11px] tracking-wider text-white/80">
            {coords.lat.toFixed(2)}, {coords.lng.toFixed(2)}
          </div>
        )}
      </div>
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
