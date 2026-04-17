import type { GameModeId } from './types.js';

export interface ModeDescriptor {
  id: GameModeId;
  label: string;
  shortLabel: string;
  description: string;
  implemented: boolean;
  usesSpeed: boolean;
  inputKind: 'text' | 'numeric' | 'list-item' | 'map' | 'drag-order';
}

export const MODE_DESCRIPTORS: Record<GameModeId, ModeDescriptor> = {
  classic: {
    id: 'classic',
    label: 'Question ouverte',
    shortLabel: 'Classique',
    description: 'Tout le monde répond librement, l’hôte valide à la révélation.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'text',
  },
  estimation: {
    id: 'estimation',
    label: 'Estimation',
    shortLabel: 'Estimation',
    description: 'Donne un chiffre : le plus proche rafle la mise.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'numeric',
  },
  'list-turns': {
    id: 'list-turns',
    label: 'Liste en tour par tour',
    shortLabel: 'Liste',
    description: 'Chacun cite un élément à son tour. Erreur, doublon ou timeout = éliminé.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'list-item',
  },
  'hot-potato': {
    id: 'hot-potato',
    label: 'Patate chaude',
    shortLabel: 'Patate',
    description: 'Annonce combien tu peux citer. Atteins l’objectif avant la fin du timer.',
    implemented: true,
    usesSpeed: true,
    inputKind: 'list-item',
  },
  'speed-elim': {
    id: 'speed-elim',
    label: 'Rapidité éliminatoire',
    shortLabel: 'Rapidité',
    description: 'Questions courtes, le plus lent est éliminé à chaque manche.',
    implemented: true,
    usesSpeed: true,
    inputKind: 'text',
  },
  map: {
    id: 'map',
    label: 'Mode carte',
    shortLabel: 'Carte',
    description: 'Place un point sur la carte le plus près possible de la cible.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'map',
  },
  chronology: {
    id: 'chronology',
    label: 'Chronologie',
    shortLabel: 'Chrono',
    description: 'Remets les événements dans le bon ordre.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'drag-order',
  },
};

export const ALL_MODES: GameModeId[] = [
  'classic',
  'estimation',
  'list-turns',
  'hot-potato',
  'speed-elim',
  'map',
  'chronology',
];

export const MVP_MODES: GameModeId[] = ['classic', 'estimation', 'list-turns'];
