import type { Avatar } from '@mvpc/shared';

export const AVATAR_EMOJIS = [
  '🦊', '🐼', '🦁', '🐸', '🐙', '🐳', '🦄', '🐲', '🦖',
  '🐵', '🦉', '🐰', '🐻', '🦝', '🐺', '🐯', '🦓', '🦩',
  '🌟', '🔥', '⚡', '🌈', '💎', '🎮', '🎲', '🚀', '👾',
] as const;

export const AVATAR_COLORS = [
  '#22D3EE', '#EC4899', '#A855F7', '#A3E635', '#FBBF24',
  '#F97316', '#3B82F6', '#10B981', '#EF4444', '#F472B6',
] as const;

/**
 * Avatars image sélectionnables dans le lobby.
 * Les fichiers vivent dans `apps/web/public/avatars/`.
 * Le champ `emoji` sert de fallback (affiché si l'image ne charge pas,
 * et satisfait le schéma partagé qui exige un emoji).
 */
export const AVATAR_IMAGES = [
  { src: '/avatars/seb-la-frite.png',    emoji: '🧢', label: 'Seb la Frite' },
  { src: '/avatars/norman.png',          emoji: '😄', label: 'Norman' },
  { src: '/avatars/le-bouseuh.png',      emoji: '🤠', label: 'LeBouseuh' },
  { src: '/avatars/kairi.png',           emoji: '🎧', label: 'TheKairi78' },
  { src: '/avatars/doncic.png',          emoji: '🏀', label: 'Luka Dončić' },
  { src: '/avatars/fat-doncic.png',      emoji: '🍔', label: 'Fat Dončić' },
  { src: '/avatars/faux.png',            emoji: '👊', label: 'FAUX' },
  { src: '/avatars/fille-brune.png',     emoji: '💁‍♀️', label: 'Miss' },
  { src: '/avatars/tropical.png',        emoji: '🌴', label: 'Tropical' },
  { src: '/avatars/lunettes.png',        emoji: '🤓', label: 'Lunettes' },
  { src: '/avatars/kyoto.png',           emoji: '⛩️', label: 'Kyoto' },
  { src: '/avatars/barbu-casquette.png', emoji: '🧢', label: 'Barbu' },
  { src: '/avatars/mec-sourire.png',     emoji: '😁', label: 'Smile' },
  { src: '/avatars/avion.png',           emoji: '✈️', label: 'Jetlag' },
  { src: '/avatars/cap-bleue.png',       emoji: '🧍', label: 'Cap' },
  { src: '/avatars/ado-serieux.png',     emoji: '😐', label: 'Sérieux' },
  { src: '/avatars/backpack.png',        emoji: '🎒', label: 'Backpack' },
] as const;

export function randomAvatar(): Avatar {
  const img = AVATAR_IMAGES[Math.floor(Math.random() * AVATAR_IMAGES.length)]!;
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
  return { emoji: img.emoji, color, image: img.src };
}

export function randomNickname(): string {
  const adj = ['Turbo', 'Mystic', 'Cosmic', 'Neon', 'Pixel', 'Rebel', 'Funky', 'Ultra', 'Stellar', 'Ninja'];
  const name = ['Otter', 'Falcon', 'Panda', 'Fox', 'Dragon', 'Lynx', 'Wolf', 'Tiger', 'Owl', 'Koala'];
  return `${adj[Math.floor(Math.random() * adj.length)]}${name[Math.floor(Math.random() * name.length)]}`;
}
