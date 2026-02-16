import { useState } from 'react';
import {
  Baby, FileText, Trash2, ChevronRight, LogOut,
  Info, Shield, X, Users, Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../contexts/AppContext';
import { deleteAllUserData } from '../lib/firestore';
import { analyzeCorrelations } from '../lib/detectiveEngine';
import { generatePdfReport } from '../lib/pdfReport';
import EditChildModal from '../components/settings/EditChildModal';

export default function SettingsPage() {
  const { state, dispatch, activeChild } = useApp();
  const [editingChild, setEditingChild] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const handleReset = async () => {
    if (confirm('Möchtest du wirklich alle Daten löschen? Dies kann nicht rückgängig gemacht werden.')) {
      if (state.currentUser) {
        try {
          await deleteAllUserData(state.currentUser);
        } catch (err) {
          console.error('Firestore delete error:', err);
        }
      }
      const key = state.currentUser ? `habeat-state-${state.currentUser.toLowerCase()}` : 'habeat-state';
      localStorage.removeItem(key);
      dispatch({ type: 'RESET' });
    }
  };

  const handleSaveChild = (updatedChild) => {
    dispatch({ type: 'UPDATE_CHILD', payload: updatedChild });
    setEditingChild(null);
  };

  const handleDeleteChild = (childId) => {
    dispatch({ type: 'REMOVE_CHILD', payload: childId });
    setEditingChild(null);
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!activeChild || exporting) return;
    setExporting(true);
    try {
      const childMeals = state.meals.filter(m => m.childId === activeChild.id);
      const childSymptoms = state.symptoms.filter(s => s.childId === activeChild.id);
      const correlation = analyzeCorrelations(childMeals, childSymptoms);
      await generatePdfReport(activeChild, childMeals, childSymptoms, correlation, state.growthEntries || []);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const sections = [
    {
      title: 'Kinder',
      items: state.children.map(child => ({
        icon: Baby,
        label: child.name,
        sublabel: `${child.knownAllergies?.length || 0} Allergien${state.activeChildId === child.id ? ' · Aktiv' : ''}`,
        action: () => setEditingChild(child),
        avatarColor: child.avatarColor,
      })),
    },
    {
      title: 'Familie',
      items: [
        {
          icon: Users,
          label: 'Großeltern einladen',
          sublabel: 'QR-Code zum Teilen',
          action: () => setActiveModal('grandparent'),
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          icon: exporting ? Loader2 : FileText,
          label: exporting ? 'Wird erstellt...' : 'PDF-Bericht exportieren',
          sublabel: 'Mit Fotos, Symptomen & Detektiv-Ergebnissen',
          action: handleExport,
        },
        {
          icon: Shield,
          label: 'Datenschutz',
          sublabel: 'Deine Daten gehören dir',
          action: () => setActiveModal('privacy'),
        },
      ],
    },
    {
      title: 'Über',
      items: [
        {
          icon: Info,
          label: 'Über HabEat',
          sublabel: 'Version 1.0.0',
          action: () => setActiveModal('about'),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Einstellungen</h1>
          {state.currentUser && (
            <p className="text-sm text-gray-400">Angemeldet als {state.currentUser}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>

      <div className="px-6 space-y-6 pb-24">
        {sections.map(section => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              {section.title}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
              {section.items.map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  className="w-full px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition text-left"
                >
                  {item.avatarColor ? (
                    <div className={`w-9 h-9 rounded-full ${item.avatarColor} flex items-center justify-center`}>
                      <span className="text-sm font-bold text-gray-700">{item.label.charAt(0)}</span>
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-sage-50 flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-sage-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    {item.sublabel && <p className="text-xs text-gray-400">{item.sublabel}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Danger Zone */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Gefahrenzone
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={handleReset}
              className="w-full px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-rose-50 transition text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-600">Alle Daten löschen</p>
                <p className="text-xs text-gray-400">Onboarding zurücksetzen</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Child Modal */}
      {editingChild && (
        <EditChildModal
          child={editingChild}
          onSave={handleSaveChild}
          onDelete={handleDeleteChild}
          onClose={() => setEditingChild(null)}
          onGrowthEntry={(entry) => dispatch({ type: 'ADD_GROWTH_ENTRY', payload: entry })}
        />
      )}

      {/* About Modal */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">Über HabEat</h2>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">🥕</span>
              </div>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-gray-800">HabEat</h3>
              <p className="text-sm text-gray-500">Version 1.0.0</p>
              <p className="text-sm text-gray-500 mt-3">
                Ernährungstracking und Allergie-Detektiv für Kleinkinder.
                Nutzt KI um Mahlzeiten zu analysieren und mögliche Unverträglichkeiten zu erkennen.
              </p>
            </div>
            <div className="bg-sage-50 rounded-xl p-3 text-center">
              <p className="text-xs text-sage-700">Powered by Gemini AI & Firebase</p>
            </div>
          </div>
        </div>
      )}

      {/* Grandparent QR Modal */}
      {activeModal === 'grandparent' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">Großeltern einladen</h2>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Großeltern scannen diesen QR-Code und können dann Mahlzeiten erfassen,
              Symptome melden und die Allergie-Karte sehen.
            </p>
            <div className="flex justify-center p-4 bg-white rounded-2xl border-2 border-dashed border-sage-200">
              <QRCodeSVG
                value={`${window.location.origin}${window.location.pathname}#/g/${btoa(state.currentUser)}`}
                size={200}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#2d5a3d"
              />
            </div>
            <div className="bg-sage-50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-sage-700 font-semibold">Was können Großeltern?</p>
              <ul className="text-xs text-sage-600 space-y-1">
                <li>&#10003; Essen fotografieren & erfassen</li>
                <li>&#10003; Symptome melden</li>
                <li>&#10003; Allergie-Karte & Notfallnummern sehen</li>
                <li className="text-gray-400">&#10007; Kein Zugriff auf Verlauf oder Detektiv</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {activeModal === 'privacy' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">Datenschutz</h2>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="bg-sage-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-1">Lokale Speicherung</h3>
                <p>Deine Daten werden im Browser (localStorage) gespeichert und zusätzlich in Firebase Cloud Firestore synchronisiert.</p>
              </div>
              <div className="bg-sage-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-1">KI-Analyse</h3>
                <p>Fotos von Mahlzeiten werden an Google Gemini AI gesendet, um Zutaten und Nährstoffe zu erkennen. Die Bilder werden nicht dauerhaft gespeichert.</p>
              </div>
              <div className="bg-sage-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-1">Keine Weitergabe</h3>
                <p>Deine Daten werden nicht an Dritte weitergegeben oder für Werbezwecke verwendet.</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-1">Daten löschen</h3>
                <p>Du kannst jederzeit alle Daten unter "Alle Daten löschen" entfernen.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
