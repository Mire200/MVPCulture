import { z } from 'zod';
import {
  AvatarSchema,
  GameConfigSchema,
  type HostValidation,
  type Player,
  type RoomSnapshot,
  type RoundReveal,
  type RoundScoring,
} from './types.js';

export const CreateRoomPayloadSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  avatar: AvatarSchema,
  playerId: z.string().optional(),
});
export type CreateRoomPayload = z.infer<typeof CreateRoomPayloadSchema>;

export const JoinRoomPayloadSchema = z.object({
  code: z.string().trim().toUpperCase().length(5),
  nickname: z.string().trim().min(1).max(20),
  avatar: AvatarSchema,
  playerId: z.string().optional(),
  hostToken: z.string().optional(),
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const StartGamePayloadSchema = z.object({
  config: GameConfigSchema.partial().optional(),
});
export type StartGamePayload = z.infer<typeof StartGamePayloadSchema>;

export const AnswerPayloadSchema = z.object({
  text: z.string().trim().max(200).optional(),
  numeric: z.number().finite().optional(),
  listItem: z.string().trim().max(80).optional(),
  bid: z.number().int().min(1).max(50).optional(),
  listItems: z.array(z.string().trim().max(80)).max(50).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  order: z.array(z.string()).max(10).optional(),
});
export type AnswerPayload = z.infer<typeof AnswerPayloadSchema>;

export const ValidatePayloadSchema = z.object({
  validations: z.array(
    z.object({
      playerId: z.string(),
      correct: z.boolean(),
    }),
  ),
});
export type ValidatePayload = z.infer<typeof ValidatePayloadSchema>;

export type ClientToServerEvents = {
  'room:create': (payload: CreateRoomPayload, ack: (res: AckResult<CreateRoomResult>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: AckResult<JoinRoomResult>) => void) => void;
  'room:leave': () => void;
  'room:resume': (
    payload: { code: string; playerId: string; hostToken?: string },
    ack: (res: AckResult<JoinRoomResult>) => void,
  ) => void;
  'game:start': (payload: StartGamePayload, ack: (res: AckResult<null>) => void) => void;
  'round:answer': (payload: AnswerPayload, ack: (res: AckResult<null>) => void) => void;
  'round:validate': (payload: ValidatePayload, ack: (res: AckResult<null>) => void) => void;
  'round:advance': (ack: (res: AckResult<null>) => void) => void;
  'match:rematch': (ack: (res: AckResult<null>) => void) => void;
};

export type ServerToClientEvents = {
  'room:state': (snapshot: RoomSnapshot) => void;
  'room:player_joined': (player: Player) => void;
  'room:player_left': (playerId: string) => void;
  'round:started': (snapshot: RoomSnapshot) => void;
  'round:tick': (payload: { endsAt: number; currentPlayerId?: string }) => void;
  'round:player_answered': (payload: { playerId: string }) => void;
  'round:eliminated': (payload: { playerId: string; reason: 'duplicate' | 'invalid' | 'timeout' }) => void;
  'round:turn_started': (payload: { currentPlayerId: string; endsAt: number }) => void;
  'round:reveal': (reveal: RoundReveal) => void;
  'round:validated': (payload: { validations: HostValidation[] }) => void;
  'round:scored': (scoring: RoundScoring) => void;
  'match:final': (payload: { standings: Player[] }) => void;
  'error': (payload: { code: string; message: string }) => void;
};

export type AckResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export type CreateRoomResult = {
  code: string;
  playerId: string;
  hostToken: string;
  snapshot: RoomSnapshot;
};

export type JoinRoomResult = {
  code: string;
  playerId: string;
  hostToken?: string;
  snapshot: RoomSnapshot;
};

export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_STARTED: 'ROOM_ALREADY_STARTED',
  NOT_HOST: 'NOT_HOST',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  RATE_LIMITED: 'RATE_LIMITED',
  PHASE_MISMATCH: 'PHASE_MISMATCH',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
