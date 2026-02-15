import { Outlet } from 'react-router-dom';
import GrandparentNav from './GrandparentNav';

export default function GrandparentShell() {
  return (
    <div className="min-h-screen bg-warm-50 max-w-lg mx-auto relative">
      <div className="pb-24">
        <Outlet />
      </div>
      <GrandparentNav />
    </div>
  );
}
