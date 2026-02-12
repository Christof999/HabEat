import { useState, useRef } from 'react';
import { Camera, Check } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const PORTION_OPTIONS = [
  { value: 'full', label: 'Ganz', icon: '🍽️' },
  { value: 'half', label: 'Halb', icon: '🍽️' },
  { value: 'some', label: 'Etwas', icon: '🍽️' },
];

// Pie-style visual for portion size
function PortionIcon({ value, selected }) {
  const fills = { full: 100, half: 50, some: 25 };
  const pct = fills[value] || 0;

  return (
    <svg viewBox="0 0 36 36" className="w-8 h-8">
      <circle cx="18" cy="18" r="16" fill="none" stroke={selected ? '#6b8f71' : '#d1d5db'} strokeWidth="2" />
      {/* Filled arc using stroke-dasharray trick */}
      <circle
        cx="18" cy="18" r="16"
        fill="none"
        stroke={selected ? '#6b8f71' : '#9ca3af'}
        strokeWidth="2"
        strokeDasharray={`${pct} ${100 - pct}`}
        strokeDashoffset="25"
        strokeLinecap="round"
        opacity={selected ? 1 : 0.4}
      />
      {/* Filled wedge */}
      <circle
        cx="18" cy="18" r="12"
        fill={selected ? '#e8f0e9' : '#f3f4f6'}
      />
      <circle
        cx="18" cy="18" r="12"
        fill={selected ? '#6b8f71' : '#d1d5db'}
        strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
        strokeDashoffset="0"
        style={{
          clipPath: pct === 100
            ? 'none'
            : pct === 50
              ? 'inset(0 50% 0 0)'
              : 'polygon(50% 0, 50% 50%, 100% 50%, 100% 0)',
        }}
        opacity={0.3}
      />
    </svg>
  );
}

export default function PortionPicker({ meal }) {
  const { dispatch } = useApp();
  const [showPicker, setShowPicker] = useState(false);
  const fileRef = useRef(null);

  const handleSelect = (value) => {
    dispatch({
      type: 'UPDATE_MEAL',
      payload: { id: meal.id, portionEaten: value },
    });
    setShowPicker(false);
  };

  const handleAfterPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      dispatch({
        type: 'UPDATE_MEAL',
        payload: { id: meal.id, afterImageUrl: reader.result },
      });
    };
    reader.readAsDataURL(file);
  };

  // Already answered — show compact badge
  if (meal.portionEaten && !showPicker) {
    const option = PORTION_OPTIONS.find(o => o.value === meal.portionEaten);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setShowPicker(true); }}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-sage-50 text-sage-700 text-xs font-medium cursor-pointer hover:bg-sage-100 transition"
      >
        <Check className="w-3 h-3" />
        {option?.label}
      </button>
    );
  }

  if (!showPicker) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setShowPicker(true); }}
        className="text-xs text-sage-500 hover:text-sage-700 font-medium cursor-pointer transition whitespace-nowrap"
      >
        Wie viel gegessen?
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {PORTION_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleSelect(opt.value)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition
            ${meal.portionEaten === opt.value
              ? 'bg-sage-100 text-sage-700 ring-1 ring-sage-300'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
        >
          <span className="text-base leading-none">
            {opt.value === 'full' ? '●' : opt.value === 'half' ? '◐' : '◔'}
          </span>
          <span>{opt.label}</span>
        </button>
      ))}

      {/* After-photo button */}
      <button
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition bg-gray-50 text-gray-500 hover:bg-gray-100"
      >
        <Camera className="w-4 h-4" />
        <span>Foto</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleAfterPhoto}
      />
    </div>
  );
}
