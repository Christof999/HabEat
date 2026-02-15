import { UtensilsCrossed, ThermometerSun, ShieldAlert, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';

const navItems = [
  { icon: UtensilsCrossed, label: 'Essen', path: '/' },
  { icon: ThermometerSun, label: 'Symptome', path: '/symptoms' },
  { icon: ShieldAlert, label: 'Allergien', path: '/emergency' },
];

export default function GrandparentNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dispatch } = useApp();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 safe-bottom z-40">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition cursor-pointer ${
                isActive
                  ? 'text-sage-600 bg-sage-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => dispatch({ type: 'LOGOUT' })}
          className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition cursor-pointer text-gray-400 hover:text-rose-500"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-xs font-semibold">Ende</span>
        </button>
      </div>
    </nav>
  );
}
