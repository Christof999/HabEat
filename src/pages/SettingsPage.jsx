import { User, Baby, Bell, FileText, Trash2, ChevronRight, LogOut, Info, Shield, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const handleReset = () => {
    if (confirm('Möchtest du wirklich alle Daten löschen? Dies kann nicht rückgängig gemacht werden.')) {
      dispatch({ type: 'RESET' });
    }
  };

  const sections = [
    {
      title: 'Kinder',
      items: [
        ...state.children.flatMap(child => ([
          {
            key: `${child.id}-edit`,
            icon: Baby,
            label: child.name,
            sublabel: `${(child.knownAllergies || child.allergies || []).length} Allergien`,
            action: () => navigate(`/settings/edit-child/${child.id}`),
            avatarColor: child.avatarColor,
            danger: false,
          },
          {
            key: `${child.id}-growth`,
            icon: TrendingUp,
            label: `Wachstum: ${child.name}`,
            sublabel: 'Größe, Gewicht, Perzentile',
            action: () => navigate(`/settings/child-growth/${child.id}`),
            avatarColor: null,
            danger: false,
          },
          {
            key: `${child.id}-delete`,
            icon: Trash2,
            label: `Profil löschen: ${child.name}`,
            sublabel: 'Aus App und Cloud entfernen',
            action: () => {
              if (confirm(`Profil „${child.name}“ wirklich löschen?`)) {
                dispatch({ type: 'REMOVE_CHILD', payload: child.id });
              }
            },
            avatarColor: null,
            danger: true,
          },
        ])),
        {
          key: 'add-child',
          icon: Baby,
          label: 'Kind hinzufügen',
          sublabel: 'Neues Profil anlegen',
          action: () => navigate('/settings/add-child'),
          avatarColor: null,
          danger: false,
        },
      ],
    },
    {
      title: 'App',
      items: [
        { key: 'notif', icon: Bell, label: 'Benachrichtigungen', sublabel: 'Erinnerungen konfigurieren', action: () => {}, avatarColor: null, danger: false },
        { key: 'pdf', icon: FileText, label: 'PDF-Export', sublabel: 'Bericht für den Kinderarzt', action: () => {}, avatarColor: null, danger: false },
        { key: 'privacy', icon: Shield, label: 'Datenschutz', sublabel: 'Deine Daten gehören dir', action: () => {}, avatarColor: null, danger: false },
      ],
    },
    {
      title: 'Über',
      items: [
        { key: 'about', icon: Info, label: 'Über HabEat', sublabel: 'Version 1.0.0', action: () => {}, avatarColor: null, danger: false },
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
                  key={item.key ?? i}
                  type="button"
                  onClick={item.action}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 cursor-pointer transition text-left ${
                    item.danger ? 'hover:bg-rose-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {item.avatarColor ? (
                    <div className={`w-9 h-9 rounded-full ${item.avatarColor} flex items-center justify-center`}>
                      <span className="text-sm font-bold text-gray-700">{(item.label?.trim()?.[0] || '?').toUpperCase()}</span>
                    </div>
                  ) : (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.danger ? 'bg-rose-50' : 'bg-sage-50'}`}>
                      <item.icon className={`w-4 h-4 ${item.danger ? 'text-rose-500' : 'text-sage-600'}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.danger ? 'text-rose-700' : 'text-gray-800'}`}>{item.label}</p>
                    {item.sublabel && <p className="text-xs text-gray-400">{item.sublabel}</p>}
                  </div>
                  {!item.danger && <ChevronRight className="w-4 h-4 text-gray-300" />}
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
    </div>
  );
}
