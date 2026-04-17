import { SocketProvider } from '@/lib/SocketProvider';

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}
