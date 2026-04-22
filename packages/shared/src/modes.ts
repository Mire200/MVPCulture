import type { GameModeId } from './types.js';

export interface ModeDescriptor {
  id: GameModeId;
  label: string;
  shortLabel: string;
  description: string;
  implemented: boolean;
  usesSpeed: boolean;
  inputKind: 'text' | 'numeric' | 'list-item' | 'map' | 'drag-order' | 'draw';
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
  qcm: {
    id: 'qcm',
    label: 'Choix multiples',
    shortLabel: 'QCM',
    description: 'Une question, quatre choix. Clique la bonne réponse — validation automatique.',
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
  'guess-who': {
    id: 'guess-who',
    label: 'Qui est-ce ?',
    shortLabel: 'Qui est-ce',
    description:
      'Chaque joueur choisit un avatar secret. Tour par tour, on devine les avatars à l’oral et on masque la grille.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'text',
  },
  imposter: {
    id: 'imposter',
    label: "Mot de l'imposteur",
    shortLabel: 'Imposteur',
    description:
      'Chacun reçoit un mot secret, sauf un imposteur avec un mot proche. Donne un indice, démasque-le au vote.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'text',
  },
  codenames: {
    id: 'codenames',
    label: 'Codenames',
    shortLabel: 'Codenames',
    description:
      "Deux équipes, deux spymasters. Donne un indice pour faire trouver tes mots avant l'équipe adverse — sans cliquer l'assassin.",
    implemented: true,
    usesSpeed: false,
    inputKind: 'text',
  },
  wikirace: {
    id: 'wikirace',
    label: 'Wikirace',
    shortLabel: 'Wikirace',
    description:
      "Course Wikipédia : rejoins la page cible en cliquant uniquement les liens internes, le plus vite possible.",
    implemented: true,
    usesSpeed: true,
    inputKind: 'text',
  },
  'gartic-phone': {
    id: 'gartic-phone',
    label: 'Gartic Phone',
    shortLabel: 'Gartic',
    description:
      'Téléphone arabe visuel : écris une phrase, dessine, devine… et découvre le résultat hilarant.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'draw',
  },
  bombparty: {
    id: 'bombparty',
    label: 'Bombparty',
    shortLabel: 'Bombe',
    description:
      'La bombe tourne ! Écris vite un mot contenant la syllabe avant l\'explosion.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'text',
  },
  'ticket-to-ride': {
    id: 'ticket-to-ride',
    label: 'Aventuriers du Rail',
    shortLabel: 'Aventuriers',
    description:
      'Piochez des cartes wagon, construisez des tronçons et complétez vos billets destination.',
    implemented: true,
    usesSpeed: false,
    inputKind: 'text',
  },
};

export const ALL_MODES: GameModeId[] = [
  'classic',
  'qcm',
  'estimation',
  'list-turns',
  'hot-potato',
  'speed-elim',
  'map',
  'chronology',
  'guess-who',
  'imposter',
  'codenames',
  'wikirace',
  'gartic-phone',
  'bombparty',
  'ticket-to-ride',
];

export const MVP_MODES: GameModeId[] = ['classic', 'estimation', 'list-turns'];
