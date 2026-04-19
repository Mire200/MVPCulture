/**
 * Static catalogue of radio tracks played on the global synchronised radio.
 * Durations are in seconds (floating point), measured via ffprobe.
 *
 * The `src` is a public URL served by the web app under /radio/...
 */

export interface RadioTrack {
  id: string;
  title: string;
  src: string;
  duration: number;
}

export const RADIO_TRACKS: readonly RadioTrack[] = [
  {
    id: 'doigby-guerrier',
    title: 'Doigby — Guerrier',
    src: '/radio/doigby-guerrier.mp3',
    duration: 165.65,
  },
  {
    id: 'michou-dans-le-club',
    title: 'Michou — Dans le club',
    src: '/radio/michou-dans-le-club.mp3',
    duration: 163.77,
  },
  {
    id: 'norman-assassin-templiers',
    title: 'Norman — Assassin des Templiers (ft. Squeezie)',
    src: '/radio/norman-assassin-templiers.mp3',
    duration: 283.65,
  },
  {
    id: 'nxxkz-charlie-kirk-funk',
    title: 'Nxxkz — Charlie Kirk Funk',
    src: '/radio/nxxkz-charlie-kirk-funk.mp3',
    duration: 80.4,
  },
  {
    id: 'fabrice-eboue-rap-gay',
    title: 'Fabrice Éboué — Rap Gay',
    src: '/radio/fabrice-eboue-rap-gay.mp3',
    duration: 116.47,
  },
  {
    id: 'squeezie-top-1',
    title: 'Squeezie — Top 1',
    src: '/radio/squeezie-top-1.mp3',
    duration: 163.47,
  },
  {
    id: 'bassem-bruits-cochon',
    title: 'Bassem — Bruits de cochon',
    src: '/radio/bassem-bruits-cochon.mp3',
    duration: 83.33,
  },
  {
    id: 'snap-tunnel',
    title: '« 1h que je suis dans un tunnel »',
    src: '/radio/snap-tunnel.mp3',
    duration: 59.95,
  },
  {
    id: 'meme-tete-ma-mere',
    title: '« La tête de ma mère j’ai 9 ans »',
    src: '/radio/meme-tete-ma-mere.mp3',
    duration: 10.89,
  },
  {
    id: 'danse-meme',
    title: 'Danse — extrait',
    src: '/radio/danse-meme.mp3',
    duration: 11.78,
  },
  {
    id: 'bassem-mal-soit-sur-toi',
    title: 'Bassem — Que le mal soit sur toi',
    src: '/radio/bassem-mal-soit-sur-toi.mp3',
    duration: 9.61,
  },
  {
    id: 'dinguerie-pleurer-racisme',
    title: 'Dinguerie de pleurer par racisme',
    src: '/radio/radio-dinguerie-pleurer-racisme.mp3',
    duration: 30.85,
  },
  {
    id: 'botkz-pain-epice',
    title: 'Botkz — embrouille avec un pain d’épice',
    src: '/radio/radio-botkz-pain-epice.mp3',
    duration: 34.59,
  },
  {
    id: 'ssstwitter-1776570017340',
    title: 'Extrait (ssstwitter)',
    src: '/radio/radio-ssstwitter-1776570017340.mp3',
    duration: 7.2,
  },
  {
    id: 'top10-jeux-2017',
    title: 'TOP 10 des jeux 2017 (clip)',
    src: '/radio/radio-top10-jeux-2017.mp3',
    duration: 185.26,
  },
  {
    id: 'on-sfait-un-fifa',
    title: 'ON S’FAIT UN FIFA — clip',
    src: '/radio/radio-on-sfait-un-fifa.mp3',
    duration: 226.82,
  },
  {
    id: 'ishowspeed-shake',
    title: 'IShowSpeed — Shake',
    src: '/radio/radio-ishowspeed-shake.mp3',
    duration: 156.85,
  },
  {
    id: 'kev-adams-yallah-yallah',
    title: 'Kev Adams — Yallah Yallah (Aladin)',
    src: '/radio/radio-kev-adams-yallah-yallah.mp3',
    duration: 151.86,
  },
];

export interface RadioStatePayload {
  trackId: string;
  title: string;
  src: string;
  duration: number;
  startedAt: number;
  serverTime: number;
}
