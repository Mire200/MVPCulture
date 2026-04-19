import type { Avatar } from '@mvpc/shared';
import { AVATAR_POOL } from '@mvpc/shared';

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
  { src: '/avatars/0o01fkmh1zd51.jpg',                                                                 emoji: '🎭', label: 'Avatar 1' },
  { src: '/avatars/1200x630.jpeg',                                                                     emoji: '🎭', label: 'Avatar 2' },
  { src: '/avatars/2000002464885.webp',                                                                emoji: '🎭', label: 'Avatar 3' },
  { src: '/avatars/335350-1.webp',                                                                     emoji: '🎭', label: 'Avatar 4' },
  { src: '/avatars/5752358-cyril-hanouna-torse-nu-pendant-ses-vacan-1200x0-1.jpg.webp',                emoji: '🎭', label: 'Hanouna' },
  { src: '/avatars/6f67d30a6e4c5dc52c322161f8d080fb.jpg',                                              emoji: '🎭', label: 'Avatar 5' },
  { src: '/avatars/759118_7.jpg',                                                                      emoji: '🎭', label: 'Avatar 6' },
  { src: '/avatars/EYJ13QQXsAQbpcs.jpg',                                                               emoji: '🎭', label: 'Avatar 7' },
  { src: '/avatars/F-6-YWuWQAAviaK.jpg',                                                               emoji: '🎭', label: 'Avatar 8' },
  { src: '/avatars/F8BF_PhWUAALW3V.jpg',                                                               emoji: '🎭', label: 'Avatar 9' },
  { src: '/avatars/G9AsGimXwAAw5kF.jpg',                                                               emoji: '🎭', label: 'Avatar 10' },
  { src: '/avatars/GLmbIntXwAAdZHj.jpg',                                                               emoji: '🎭', label: 'Avatar 11' },
  { src: '/avatars/GQn34t-XwAAABVr.jpg',                                                               emoji: '🎭', label: 'Avatar 12' },
  { src: '/avatars/Gp3hM8FWMAAKCkn.jpg',                                                               emoji: '🎭', label: 'Avatar 13' },
  { src: '/avatars/Gxm_VeuWIAArXuN.jpg',                                                               emoji: '🎭', label: 'Avatar 14' },
  { src: '/avatars/MBwgXfMYDgMiQ4BA8LTOtBadhjdixwGr0Wzjt01T.jpg',                                      emoji: '🎭', label: 'Avatar 15' },
  { src: '/avatars/MissJirachietDavidLafargePokemon-810x400.jpg',                                      emoji: '🎮', label: 'Miss Jirachi' },
  { src: '/avatars/MjAxNzEwMDU4NTk0MTE0MGYxYWI4ZWJkMTQ0ZWJmNjMwMWMzZjA.webp',                          emoji: '🎭', label: 'Avatar 16' },
  { src: '/avatars/MjAyNjAzZTIyYzc5MmJjODU2NTYzYmY0ZDMxMmNkNmRmNzkzNGI.avif',                          emoji: '🎭', label: 'Avatar 17' },
  { src: '/avatars/PQX1ZotF_400x400.webp',                                                             emoji: '🎭', label: 'Avatar 18' },
  { src: '/avatars/Sausage_Party_logo.png',                                                            emoji: '🌭', label: 'Sausage Party' },
  { src: '/avatars/Screenshot-2026-03-27-at-19.04.36.jpeg.webp',                                       emoji: '📸', label: 'Screenshot' },
  { src: '/avatars/UsA1VgAJl2FMau1i.jpg',                                                              emoji: '🎭', label: 'Avatar 19' },
  { src: '/avatars/ab67616d0000b27389c39018fb55f262ac97866f.jpeg',                                     emoji: '🎭', label: 'Avatar 20' },
  { src: '/avatars/c9f00ded2b6e7e61e786871103feff25.800x800x1.jpg',                                    emoji: '🎭', label: 'Avatar 21' },
  { src: '/avatars/channels4_profile.jpg',                                                             emoji: '🎭', label: 'Channel' },
  { src: '/avatars/despo-rutti_hero.jpg',                                                              emoji: '🎤', label: 'Despo Rutti' },
  { src: '/avatars/f0661b0e86cabf43bac030a135e041f2.640x640x1.png',                                    emoji: '🎭', label: 'Avatar 22' },
  { src: '/avatars/hq720.jpg',                                                                         emoji: '🎭', label: 'Avatar 23' },
  { src: '/avatars/iGrgOhIu_400x400.jpg',                                                              emoji: '🎭', label: 'Avatar 24' },
  { src: '/avatars/image-1.jpg',                                                                       emoji: '🎭', label: 'Avatar 25' },
  { src: '/avatars/images-3.jpeg',                                                                     emoji: '🎭', label: 'Avatar 26' },
  { src: '/avatars/images-4.jpeg',                                                                     emoji: '🎭', label: 'Avatar 27' },
  { src: '/avatars/images-5.jpeg',                                                                     emoji: '🎭', label: 'Avatar 28' },
  { src: '/avatars/images-6.jpeg',                                                                     emoji: '🎭', label: 'Avatar 29' },
  { src: '/avatars/images-7.jpeg',                                                                     emoji: '🎭', label: 'Avatar 30' },
  { src: '/avatars/images-8.jpeg',                                                                     emoji: '🎭', label: 'Avatar 31' },
  { src: '/avatars/images-9.jpeg',                                                                     emoji: '🎭', label: 'Avatar 32' },
  { src: '/avatars/images-10.jpeg',                                                                    emoji: '🎭', label: 'Avatar 33' },
  { src: '/avatars/images-11.jpeg',                                                                    emoji: '🎭', label: 'Avatar 34' },
  { src: '/avatars/images-12.jpeg',                                                                    emoji: '🎭', label: 'Avatar 35' },
  { src: '/avatars/images-13.jpeg',                                                                    emoji: '🎭', label: 'Avatar 36' },
  { src: '/avatars/images-14.jpeg',                                                                    emoji: '🎭', label: 'Avatar 37' },
  { src: '/avatars/images-15.jpeg',                                                                    emoji: '🎭', label: 'Avatar 38' },
  { src: '/avatars/images-16.jpeg',                                                                    emoji: '🎭', label: 'Avatar 39' },
  { src: '/avatars/images-17.jpeg',                                                                    emoji: '🎭', label: 'Avatar 40' },
  { src: '/avatars/images-18.jpeg',                                                                    emoji: '🎭', label: 'Avatar 41' },
  { src: '/avatars/images-19.jpeg',                                                                    emoji: '🎭', label: 'Avatar 42' },
  { src: '/avatars/maxresdefault-4.jpg',                                                               emoji: '🎭', label: 'Avatar 43' },
  { src: '/avatars/oar2.jpg',                                                                          emoji: '🎭', label: 'Avatar 44' },
  { src: '/avatars/sans-titre-5.png',                                                                  emoji: '🎭', label: 'Avatar 45' },
  { src: '/avatars/sddefault-3.jpg',                                                                   emoji: '🎭', label: 'Avatar 46' },
  { src: '/avatars/snoop-catt-v0-zVLjlZmgIDBgRTFnBD8DpIQSf2S2c1p-pequVhUjdWA.jpg.webp',                emoji: '🐱', label: 'Snoop Catt' },
  { src: '/avatars/so-5c0010ce66a4bd9e4c6a4924-ph0.jpg',                                               emoji: '🎭', label: 'Avatar 47' },
  { src: '/avatars/unnamed-3.jpg',                                                                     emoji: '🎭', label: 'Avatar 48' },
  { src: '/avatars/vodk-prod-youtube-1.jpg.webp',                                                      emoji: '🎬', label: 'Vodk' },
  { src: '/avatars/what-do-you-guys-think-of-beardless-james-harden-v0-9mpbrdx0lx1g1.png.webp',        emoji: '🏀', label: 'Harden' },
  { src: '/avatars/roi-heenok-fuhrer.png',              emoji: '🎤', label: 'Roi Heenok — Führer Heenoko' },
  { src: '/avatars/duo-streamer-gingerbread.png',       emoji: '🍪', label: 'Streamer + bonhomme pain d’épices' },
  { src: '/avatars/streamer-micro-glasses.png',       emoji: '🎙️', label: 'Streamer micro' },
  { src: '/avatars/kirkification-meme.png',            emoji: '🧢', label: 'Kirkification' },
  { src: '/avatars/timeout-t-pose-meme.png',           emoji: '✋', label: 'Timeout T' },
  { src: '/avatars/meme-zoom-face.png',                  emoji: '😵', label: 'Zoom meme' },
  { src: '/avatars/diddy-cover.png',                   emoji: '🕶️', label: 'Diddy' },
  { src: '/avatars/parka-fur-hood.png',                emoji: '🧥', label: 'Parka à capuche' },
] as const;

export function randomAvatar(): Avatar {
  const img = AVATAR_IMAGES[Math.floor(Math.random() * AVATAR_IMAGES.length)]!;
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
  return { emoji: img.emoji, color, image: img.src };
}

const AVATAR_META_BY_SRC: Record<string, { emoji: string; label: string }> = (() => {
  const map: Record<string, { emoji: string; label: string }> = {};
  for (const a of AVATAR_IMAGES) map[a.src] = { emoji: a.emoji, label: a.label };
  return map;
})();

export function getAvatarMeta(src: string): { emoji: string; label: string } {
  return AVATAR_META_BY_SRC[src] ?? { emoji: '🎭', label: src.split('/').pop() ?? 'Avatar' };
}

export { AVATAR_POOL };

export function randomNickname(): string {
  const adj = ['Turbo', 'Mystic', 'Cosmic', 'Neon', 'Pixel', 'Rebel', 'Funky', 'Ultra', 'Stellar', 'Ninja'];
  const name = ['Otter', 'Falcon', 'Panda', 'Fox', 'Dragon', 'Lynx', 'Wolf', 'Tiger', 'Owl', 'Koala'];
  return `${adj[Math.floor(Math.random() * adj.length)]}${name[Math.floor(Math.random() * name.length)]}`;
}
