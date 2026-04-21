/**
 * Catalogue statique des clips vidéo diffusés sur la télé synchronisée du lobby.
 * Durées en secondes (flottant), mesurées via ffprobe. Les sources sont servies
 * en statique par l'app web sous /videos/tv/...
 */

export interface TvClip {
  id: string;
  src: string;
  duration: number;
}

export const TV_CLIPS: readonly TvClip[] = [
  { id: 'tv-001', src: '/videos/tv/tv-001.mp4', duration: 19.78 },
  { id: 'tv-002', src: '/videos/tv/tv-002.mp4', duration: 7.87 },
  { id: 'tv-003', src: '/videos/tv/tv-003.mp4', duration: 7.87 },
  { id: 'tv-004', src: '/videos/tv/tv-004.mp4', duration: 11.98 },
  { id: 'tv-005', src: '/videos/tv/tv-005.mp4', duration: 14.02 },
  { id: 'tv-006', src: '/videos/tv/tv-006.mp4', duration: 5.46 },
  { id: 'tv-007', src: '/videos/tv/tv-007.mp4', duration: 25.24 },
  { id: 'tv-008', src: '/videos/tv/tv-008.mp4', duration: 12.61 },
  { id: 'tv-009', src: '/videos/tv/tv-009.mp4', duration: 36.59 },
  { id: 'tv-010', src: '/videos/tv/tv-010.mp4', duration: 12.44 },
  { id: 'tv-011', src: '/videos/tv/tv-011.mp4', duration: 8.59 },
  { id: 'tv-012', src: '/videos/tv/tv-012.mp4', duration: 39.08 },
  { id: 'tv-013', src: '/videos/tv/tv-013.mp4', duration: 3.72 },
  { id: 'tv-014', src: '/videos/tv/tv-014.mp4', duration: 37.71 },
  { id: 'tv-015', src: '/videos/tv/tv-015.mp4', duration: 17.3 },
  { id: 'tv-016', src: '/videos/tv/tv-016.mp4', duration: 8.57 },
  { id: 'tv-017', src: '/videos/tv/tv-017.mp4', duration: 20.67 },
  { id: 'tv-018', src: '/videos/tv/tv-018.mp4', duration: 13.29 },
  { id: 'tv-019', src: '/videos/tv/tv-019.mp4', duration: 8.38 },
  { id: 'tv-020', src: '/videos/tv/tv-020.mp4', duration: 42.84 },
  { id: 'tv-021', src: '/videos/tv/tv-021.mp4', duration: 65.2 },
  { id: 'tv-022', src: '/videos/tv/tv-022.mp4', duration: 11.33 },
  { id: 'tv-023', src: '/videos/tv/tv-023.mp4', duration: 30.53 },
  { id: 'tv-024', src: '/videos/tv/tv-024.mp4', duration: 8.61 },
  { id: 'tv-025', src: '/videos/tv/tv-025.mp4', duration: 9.22 },
  { id: 'tv-026', src: '/videos/tv/tv-026.mp4', duration: 37.63 },
  { id: 'tv-027', src: '/videos/tv/tv-027.mp4', duration: 10.75 },
  { id: 'tv-028', src: '/videos/tv/tv-028.mp4', duration: 13.82 },
  { id: 'tv-029', src: '/videos/tv/tv-029.mp4', duration: 16.97 },
  { id: 'tv-030', src: '/videos/tv/tv-030.mp4', duration: 20.76 },
  { id: 'tv-031', src: '/videos/tv/tv-031.mp4', duration: 33.25 },
  { id: 'tv-032', src: '/videos/tv/tv-032.mp4', duration: 20.78 },
  { id: 'tv-033', src: '/videos/tv/tv-033.mp4', duration: 42.45 },
  { id: 'tv-034', src: '/videos/tv/tv-034.mp4', duration: 22.64 },
  { id: 'tv-035', src: '/videos/tv/tv-035.mp4', duration: 52.29 },
  { id: 'tv-036', src: '/videos/tv/tv-036.mp4', duration: 16.86 },
  { id: 'tv-037', src: '/videos/tv/tv-037.mp4', duration: 33.85 },
  { id: 'tv-038', src: '/videos/tv/tv-038.mp4', duration: 8.68 },
  { id: 'tv-039', src: '/videos/tv/tv-039.mp4', duration: 31.39 },
  { id: 'tv-040', src: '/videos/tv/tv-040.mp4', duration: 11.54 },
  { id: 'tv-041', src: '/videos/tv/tv-041.mp4', duration: 42.7 },
  { id: 'tv-042', src: '/videos/tv/tv-042.mp4', duration: 5.85 },
  { id: 'tv-043', src: '/videos/tv/tv-043.mp4', duration: 8.08 },
  { id: 'tv-044', src: '/videos/tv/tv-044.mp4', duration: 5.15 },
  { id: 'tv-045', src: '/videos/tv/tv-045.mp4', duration: 36.22 },
  { id: 'tv-046', src: '/videos/tv/tv-046.mp4', duration: 9.66 },
  { id: 'tv-047', src: '/videos/tv/tv-047.mp4', duration: 11.96 },
  { id: 'tv-048', src: '/videos/tv/tv-048.mp4', duration: 6.31 },
  { id: 'tv-049', src: '/videos/tv/tv-049.mp4', duration: 8.17 },
  { id: 'tv-050', src: '/videos/tv/tv-050.mp4', duration: 6.71 },
  { id: 'tv-051', src: '/videos/tv/tv-051.mp4', duration: 36.66 },
  { id: 'tv-052', src: '/videos/tv/tv-052.mp4', duration: 8.81 },
  { id: 'tv-053', src: '/videos/tv/tv-053.mp4', duration: 14.74 },
  { id: 'tv-054', src: '/videos/tv/tv-054.mp4', duration: 14.81 },
  { id: 'tv-055', src: '/videos/tv/tv-055.mp4', duration: 5.74 },
  { id: 'tv-056', src: '/videos/tv/tv-056.mp4', duration: 6.45 },
  { id: 'tv-057', src: '/videos/tv/tv-057.mp4', duration: 8.94 },
];

export interface TvStatePayload {
  clipId: string;
  src: string;
  duration: number;
  startedAt: number;
  serverTime: number;
}
