import { SocketProvider } from '@/lib/SocketProvider';
import { RadioPlayer } from '@/components/RadioPlayer';

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      {children}
      <RadioPlayer />
    </SocketProvider>
  );
}
