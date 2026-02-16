import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, AlertTriangle, ThermometerSun, Moon,
  Frown, Wind, HelpCircle, Clock, ChevronDown, ChevronUp, Camera,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import SymptomDetailModal from '../components/detective/SymptomDetailModal';

const SYMPTOM_ICONS = {
  skin: ThermometerSun,
  digestion: AlertTriangle,
  sleep: Moon,
  mood: Frown,
  breathing: Wind,
  other: HelpCircle,
};

const SYMPTOM_LABELS = {
  skin: 'Haut',
  digestion: 'Verdauung',
  sleep: 'Schlaf',
  mood: 'Stimmung',
  breathing: 'Atmung',
  other: 'Sonstiges',
};

const SYMPTOM_COLORS = {
  skin: 'bg-rose-50 text-rose-600',
  digestion: 'bg-warm-50 text-warm-600',
  sleep: 'bg-sky-50 text-sky-600',
  mood: 'bg-sage-50 text-sage-600',
  breathing: 'bg-sky-50 text-sky-700',
  other: 'bg-gray-50 text-gray-600',
};

export default function SymptomHistoryPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [selectedSymptom, setSelectedSymptom] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set());

  const childSymptoms = state.symptoms.filter(s => s.childId === state.activeChildId);

  const groupedByDate = useMemo(() => {
    const groups = {};
    childSymptoms.forEach(symptom => {
      const dateKey = new Date(symptom.timestamp).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(symptom);
    });
    // Sort each day's symptoms by time (newest first)
    Object.values(groups).forEach(arr =>
      arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    );
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [childSymptoms]);

  // Auto-expand today and yesterday
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const isExpanded = (dateStr) =>
    expandedDays.has(dateStr) || dateStr === today || dateStr === yesterday;

  const toggleDay = (dateStr) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      // For today/yesterday, toggling adds them to the set to collapse
      if (dateStr === today || dateStr === yesterday) {
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
      } else {
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
      }
      return next;
    });
  };

  // For today/yesterday: expanded by default, clicking collapses (adds to set)
  // For other days: collapsed by default, clicking expands (adds to set)
  const isDayExpanded = (dateStr) => {
    const isRecentDay = dateStr === today || dateStr === yesterday;
    if (isRecentDay) return !expandedDays.has(dateStr);
    return expandedDays.has(dateStr);
  };

  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const todayDate = new Date();
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    if (date.toDateString() === todayDate.toDateString()) return 'Heute';
    if (date.toDateString() === yesterdayDate.toDateString()) return 'Gestern';
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const daySummary = (symptoms) => {
    const maxSeverity = Math.max(...symptoms.map(s => s.severity));
    const types = [...new Set(symptoms.map(s => s.type))];
    return { count: symptoms.length, maxSeverity, types };
  };

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/detective')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Symptom-Verlauf</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {childSymptoms.length} {childSymptoms.length === 1 ? 'Symptom' : 'Symptome'} erfasst
            </p>
          </div>
        </div>
      </div>

      {/* Day Groups */}
      <div className="px-6 space-y-3 pb-28">
        {groupedByDate.length > 0 ? (
          groupedByDate.map(([dateStr, symptoms]) => {
            const { count, maxSeverity, types } = daySummary(symptoms);
            const expanded = isDayExpanded(dateStr);

            return (
              <div key={dateStr} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Day Header */}
                <button
                  onClick={() => toggleDay(dateStr)}
                  className="w-full px-5 py-4 flex items-center gap-4 cursor-pointer text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-warm-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-warm-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      {formatDateLabel(dateStr)}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {count} {count === 1 ? 'Symptom' : 'Symptome'}
                      </span>
                      <span className="text-gray-300">·</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-3 rounded-full ${
                              i < maxSeverity ? 'bg-warm-400' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex -space-x-1 ml-1">
                        {types.slice(0, 3).map(type => {
                          const Icon = SYMPTOM_ICONS[type] || AlertTriangle;
                          return (
                            <div key={type} className={`w-5 h-5 rounded-full ${SYMPTOM_COLORS[type]} flex items-center justify-center`}>
                              <Icon className="w-2.5 h-2.5" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {expanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-300" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-300" />
                  )}
                </button>

                {/* Symptom List */}
                {expanded && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {symptoms.map(symptom => {
                      const Icon = SYMPTOM_ICONS[symptom.type] || AlertTriangle;
                      const colorClass = SYMPTOM_COLORS[symptom.type] || 'bg-gray-50 text-gray-600';

                      return (
                        <button
                          key={symptom.id}
                          onClick={() => setSelectedSymptom(symptom)}
                          className="w-full px-5 py-3.5 flex items-center gap-3 cursor-pointer text-left hover:bg-gray-50/50 transition"
                        >
                          {/* Time */}
                          <div className="w-12 text-center shrink-0">
                            <p className="text-sm font-semibold text-gray-700">{formatTime(symptom.timestamp)}</p>
                          </div>

                          {/* Divider line */}
                          <div className="w-px h-10 bg-gray-200 shrink-0" />

                          {/* Icon */}
                          <div className={`w-9 h-9 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-gray-800">
                                {SYMPTOM_LABELS[symptom.type]}
                              </p>
                              {(symptom.photoUrl || symptom.photoStorageUrl) && (
                                <Camera className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">
                              {symptom.notes || 'Keine Beschreibung'}
                            </p>
                          </div>

                          {/* Severity bars */}
                          <div className="flex gap-0.5 shrink-0">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-4 rounded-full ${
                                  i < symptom.severity ? 'bg-warm-400' : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-10 h-10 text-warm-200 mb-3" />
            <h3 className="font-semibold text-gray-700">Noch keine Symptome</h3>
            <p className="text-gray-400 text-sm mt-1">
              Erfasse Symptome auf der Detektiv-Seite, um den Verlauf hier zu sehen.
            </p>
          </div>
        )}
      </div>

      {/* Symptom Detail Modal */}
      {selectedSymptom && (
        <SymptomDetailModal
          symptom={selectedSymptom}
          onClose={() => setSelectedSymptom(null)}
        />
      )}
    </div>
  );
}
