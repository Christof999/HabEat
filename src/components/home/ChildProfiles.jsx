import { Plus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export default function ChildProfiles({ onAddChild }) {
  const { state, dispatch } = useApp();

  return (
    <div className="py-4">
      <div className="flex items-center gap-4 overflow-x-auto overflow-y-visible scrollbar-hide pt-2 pb-3 px-6">
        {state.children.map(child => {
          const isActive = child.id === state.activeChildId;
          return (
            <button
              key={child.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_CHILD', payload: child.id })}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <div
                className={`w-16 h-16 rounded-full ${child.avatarColor} flex items-center justify-center transition-all ${
                  isActive
                    ? 'ring-[3px] ring-sage-500 ring-offset-2 scale-105'
                    : 'opacity-60 hover:opacity-80'
                }`}
              >
                {child.photoUrl ? (
                  <img
                    src={child.photoUrl}
                    alt={child.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-gray-700">
                    {(child.name?.trim()?.[0] || '?').toUpperCase()}
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-medium truncate max-w-[4.5rem] ${
                  isActive ? 'text-gray-800' : 'text-gray-500'
                }`}
              >
                {child.name}
              </span>
            </button>
          );
        })}

        {/* Add Child Button */}
        <button
          onClick={onAddChild}
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-sage-300 flex items-center justify-center hover:border-sage-500 hover:bg-sage-50 transition">
            <Plus className="w-5 h-5 text-sage-400" />
          </div>
          <span className="text-xs font-medium text-gray-400">Hinzufügen</span>
        </button>
      </div>
    </div>
  );
}
