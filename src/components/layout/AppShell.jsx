import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-warm-50 max-w-lg mx-auto relative">
      <div className="pb-20">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
