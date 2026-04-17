'use client';
import { motion } from 'framer-motion';
import { AVATAR_COLORS, AVATAR_IMAGES } from '@/lib/avatars';
import type { Avatar } from '@mvpc/shared';
import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export function AvatarBadge({
  avatar,
  size = 'md',
  pulse = false,
  className,
}: {
  avatar: Avatar;
  size?: Size;
  pulse?: boolean;
  className?: string;
}) {
  const hasImage = !!avatar.image;
  return (
    <div
      className={cn('avatar-badge', size, className)}
      style={{
        background: hasImage
          ? '#1c1635'
          : `linear-gradient(135deg, ${avatar.color}, ${avatar.color}88)`,
        boxShadow: pulse
          ? `0 0 0 2px ${avatar.color}, 0 0 24px ${avatar.color}aa`
          : undefined,
        overflow: 'hidden',
      }}
    >
      {hasImage ? (
        // Portrait image — masque circulaire via .avatar-badge
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar.image}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span>{avatar.emoji}</span>
      )}
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: Avatar;
  onChange: (next: Avatar) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-9">
        {AVATAR_IMAGES.map((opt) => {
          const selected = value.image === opt.src;
          return (
            <motion.button
              key={opt.src}
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                onChange({
                  ...value,
                  emoji: opt.emoji,
                  image: opt.src,
                })
              }
              title={opt.label}
              aria-label={opt.label}
              className={cn(
                'relative aspect-square overflow-hidden rounded-full border-2 transition',
                selected
                  ? 'border-neon-cyan shadow-glow-cyan scale-105'
                  : 'border-border hover:border-border-strong',
              )}
              style={{ background: '#1c1635' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opt.src}
                alt=""
                draggable={false}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </motion.button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {AVATAR_COLORS.map((color) => (
          <motion.button
            key={color}
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange({ ...value, color })}
            className={cn(
              'w-8 h-8 rounded-full border-2 transition',
              value.color === color ? 'border-white scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: color }}
            aria-label={`Couleur ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
