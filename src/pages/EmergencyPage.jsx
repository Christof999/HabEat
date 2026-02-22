import { ShieldAlert, Phone, AlertTriangle, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

export default function EmergencyPage() {
  const { activeChild, state } = useApp();
  const [copied, setCopied] = useState(false);
  const childAllergies = activeChild?.knownAllergies || activeChild?.allergies || [];

  const handleCopy = () => {
    if (!activeChild) return;
    const text = [
      `ALLERGIE-NOTFALLKARTE`,
      `Name: ${activeChild.name}`,
      `Geburtsdatum: ${new Date(activeChild.birthDate).toLocaleDateString('de-DE')}`,
      childAllergies.length > 0
        ? `Allergien: ${childAllergies.join(', ')}`
        : 'Keine bekannten Allergien',
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!activeChild) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6">
        <ShieldAlert className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-gray-500">Bitte wähle zuerst ein Kind aus.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-gray-800">Notfall-Karte</h1>
        <p className="text-gray-400 text-sm mt-0.5">Schnellzugriff auf wichtige Informationen</p>
      </div>

      <div className="px-6 space-y-4 pb-24">
        {/* Emergency Card */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="bg-rose-50 px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="font-bold text-rose-800">Allergie-Notfallkarte</h2>
              <p className="text-xs text-rose-600">Immer griffbereit</p>
            </div>
          </div>

          {/* Child Info */}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${activeChild.avatarColor} flex items-center justify-center`}>
                <span className="text-lg font-bold text-gray-700">
                  {activeChild.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{activeChild.name}</h3>
                <p className="text-sm text-gray-500">
                  Geb. {new Date(activeChild.birthDate).toLocaleDateString('de-DE')}
                </p>
              </div>
            </div>

            {/* Allergies */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Bekannte Allergien
              </h4>
              {childAllergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {childAllergies.map(a => (
                    <span
                      key={a}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold bg-rose-100 text-rose-700 flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Keine bekannten Allergien eingetragen.</p>
              )}
            </div>

            {/* Physical Info */}
            {(activeChild.height || activeChild.weight) && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Körpermaße
                </h4>
                <div className="flex gap-4">
                  {activeChild.height && (
                    <div className="bg-gray-50 rounded-xl px-4 py-2">
                      <span className="text-xs text-gray-500">Größe</span>
                      <p className="font-bold text-gray-800">{activeChild.height} cm</p>
                    </div>
                  )}
                  {activeChild.weight && (
                    <div className="bg-gray-50 rounded-xl px-4 py-2">
                      <span className="text-xs text-gray-500">Gewicht</span>
                      <p className="font-bold text-gray-800">{activeChild.weight} kg</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:shadow-md transition"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-sage-600" />
              <span className="text-sm font-medium text-sage-600">Kopiert!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Karte kopieren</span>
            </>
          )}
        </button>

        {/* Emergency Contacts Placeholder */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-sage-600" />
            Notfallkontakte
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <User className="w-4 h-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-400">Kinderarzt hinzufügen</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Kontakte können in den Einstellungen hinzugefügt werden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
