import { Room, generateRoomCode } from './Room.js';

export class RoomManager {
  private rooms = new Map<string, Room>();

  create(): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room = new Room('_pending_', code);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  delete(code: string): void {
    this.rooms.delete(code.toUpperCase());
  }

  all(): Room[] {
    return [...this.rooms.values()];
  }
}
