import { X, AlertTriangle, ThermometerSun, Moon, Frown, Wind, HelpCircle, Clock, FileText, Camera } from 'lucide-react';

const symptomTypes = {
  skin: { label: 'Haut', sublabel: 'Ausschlag, Rötung, Juckreiz', icon: ThermometerSun, color: 'bg-rose-50 text-rose-600', bgLight: 'bg-rose-50' },
  digestion: { label: 'Verdauung', sublabel: 'Durchfall, Erbrechen, Bauchschmerzen', icon: AlertTriangle, color: 'bg-warm-50 text-warm-600', bgLight: 'bg-warm-50' },
  sleep: { label: 'Schlaf', sublabel: 'Unruhe, Aufwachen, Weinen', icon: Moon, color: 'bg-sky-50 text-sky-600', bgLight: 'bg-sky-50' },
  mood: { label: 'Stimmung', sublabel: 'Quengelig, Appetitlosigkeit', icon: Frown, color: 'bg-sage-50 text-sage-600', bgLight: 'bg-sage-50' },
  breathing: { label: 'Atmung', sublabel: 'Husten, Schnupfen, Keuchen', icon: Wind, color: 'bg-sky-50 text-sky-700', bgLight: 'bg-sky-50' },
  other: { label: 'Sonstiges', sublabel: 'Andere Beobachtungen', icon: HelpCircle, color: 'bg-gray-50 text-gray-600', bgLight: 'bg-gray-50' },
};

const severityLevels = [
  { value: 1, label: 'Leicht', color: 'bg-sage-100 text-sage-700' },
  { value: 2, label: 'Mild', color: 'bg-sky-100 text-sky-700' },
  { value: 3, label: 'Mittel', color: 'bg-warm-100 text-warm-700' },
  { value: 4, label: 'Stark', color: 'bg-rose-100 text-rose-700' },
  { value: 5, label: 'Sehr stark', color: 'bg-rose-200 text-rose-800' },
];

export default function SymptomDetailModal({ symptom, onClose }) {
  const typeInfo = symptomTypes[symptom.type] || symptomTypes.other;
  const Icon = typeInfo.icon;
  const severityInfo = severityLevels[symptom.severity - 1] || severityLevels[2];
  const photoSrc = symptom.photoUrl || symptom.photoStorageUrl;

  const timestamp = new Date(symptom.timestamp);
  const dateStr = timestamp.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = timestamp.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto safe-bottom">
        {/* Photo */}
        {photoSrc && (
          <div className="relative">
            <img
              src={photoSrc}
              alt="Symptom-Foto"
              className="w-full h-56 object-cover rounded-t-3xl sm:rounded-t-3xl"
            />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className={`sticky top-0 bg-white ${!photoSrc ? 'rounded-t-3xl' : ''} px-6 py-5 border-b border-gray-100 flex items-center justify-between z-10`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${typeInfo.color} flex items-center justify-center`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">{typeInfo.label}</h2>
              <p className="text-xs text-gray-400">{typeInfo.sublabel}</p>
            </div>
          </div>
          {!photoSrc && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Time */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{dateStr}</p>
              <p className="text-xs text-gray-400">um {timeStr} Uhr</p>
            </div>
          </div>

          {/* Severity */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Schweregrad</p>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-6 rounded-full ${
                      i < symptom.severity ? 'bg-warm-400' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${severityInfo.color}`}>
                {severityInfo.label} ({symptom.severity}/5)
              </span>
            </div>
          </div>

          {/* Notes */}
          {symptom.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Beschreibung</p>
              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">{symptom.notes}</p>
              </div>
            </div>
          )}

          {!symptom.notes && !photoSrc && (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400">Keine Beschreibung hinterlegt</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
