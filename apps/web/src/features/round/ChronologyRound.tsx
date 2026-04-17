'use client';
import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Clock, GripVertical, Send, Check } from 'lucide-react';

function SortableItem({ id, label, index }: { id: string; label: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 p-3 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-white/5 cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-accent-cyan' : ''
      }`}
    >
      <GripVertical className="w-4 h-4 text-text-dim" />
      <div className="w-7 h-7 rounded-full bg-surface-3 text-xs flex items-center justify-center font-display">
        {index + 1}
      </div>
      <div className="flex-1 text-sm">{label}</div>
    </div>
  );
}

export function ChronologyRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const alreadyAnswered = useGameStore((s) => (myId ? s.answeredPlayerIds.has(myId) : false));
  const round = snapshot?.round;
  const events = round?.question?.events ?? [];

  const initialIds = useMemo(() => events.map((e) => e.id), [events]);
  const [order, setOrder] = useState<string[]>(initialIds);
  const [submitted, setSubmitted] = useState(false);

  // Resync si les events arrivent plus tard
  useMemo(() => {
    if (order.length !== initialIds.length) setOrder(initialIds);
  }, [initialIds, order.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setOrder((prev) => arrayMove(prev, oldIdx, newIdx));
  };

  const send = () => {
    if (submitted) return;
    setSubmitted(true);
    const socket = getSocket();
    socket.emit('round:answer', { order }, (res) => {
      if (!res.ok) {
        setSubmitted(false);
        alert(res.message);
      }
    });
  };

  const done = submitted || alreadyAnswered;

  if (events.length === 0) return null;
  const map = new Map(events.map((e) => [e.id, e.label]));

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center gap-2 text-accent-violet">
        <Clock className="w-5 h-5" />
        <span className="font-semibold">Remets dans l'ordre chronologique (du plus ancien au plus récent)</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((id, i) => (
              <SortableItem key={id} id={id} label={map.get(id) ?? id} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={done}
        onClick={send}
        className="btn-primary w-full disabled:opacity-60"
      >
        {done ? (
          <>
            <Check className="w-5 h-5" /> Ordre envoyé
          </>
        ) : (
          <>
            <Send className="w-5 h-5" /> Valider l'ordre
          </>
        )}
      </motion.button>
    </div>
  );
}
