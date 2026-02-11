import {
  ShieldAlert, Phone, AlertTriangle, Copy, Check,
  Plus, X, Pencil, Trash2, Stethoscope,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

const DEFAULT_CONTACTS = [
  { id: '__notruf', name: 'Notruf', phone: '112', type: 'emergency', isDefault: true },
  { id: '__giftnotruf', name: 'Giftnotruf', phone: '030 19240', type: 'poison', isDefault: true },
];

function ContactCard({ contact, onCall, onEdit, onDelete }) {
  const iconBg = contact.type === 'emergency' ? 'bg-rose-100'
    : contact.type === 'poison' ? 'bg-warm-100'
    : 'bg-sage-100';
  const iconColor = contact.type === 'emergency' ? 'text-rose-600'
    : contact.type === 'poison' ? 'text-warm-600'
    : 'text-sage-600';

  return (
    <div className="flex items-center gap-3 p-3.5">
      <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        {contact.type === 'doctor' ? (
          <Stethoscope className={`w-4 h-4 ${iconColor}`} />
        ) : (
          <Phone className={`w-4 h-4 ${iconColor}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{contact.name}</p>
        <p className="text-xs text-gray-500">{contact.phone}</p>
        {contact.address && <p className="text-xs text-gray-400 truncate">{contact.address}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!contact.isDefault && onEdit && (
          <button
            onClick={() => onEdit(contact)}
            className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
        {!contact.isDefault && onDelete && (
          <button
            onClick={() => onDelete(contact.id)}
            className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-rose-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
        <a
          href={`tel:${contact.phone.replace(/\s/g, '')}`}
          className="w-10 h-10 rounded-xl bg-sage-500 flex items-center justify-center cursor-pointer hover:bg-sage-600 transition"
        >
          <Phone className="w-4 h-4 text-white" />
        </a>
      </div>
    </div>
  );
}

function AddContactModal({ contact, onSave, onClose }) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    address: contact?.address || '',
  });

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    onSave({
      id: contact?.id || crypto.randomUUID(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      type: 'doctor',
      isDefault: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-800">
            {isEdit ? 'Kontakt bearbeiten' : 'Kinderarzt hinzufügen'}
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="z.B. Dr. Müller"
              className="w-full px-4 py-3 rounded-xl bg-warm-50 border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Telefonnummer *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => updateField('phone', e.target.value)}
              placeholder="z.B. 089 12345678"
              className="w-full px-4 py-3 rounded-xl bg-warm-50 border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Adresse (optional)</label>
            <input
              type="text"
              value={form.address}
              onChange={e => updateField('address', e.target.value)}
              placeholder="z.B. Musterstr. 1, 80331 München"
              className="w-full px-4 py-3 rounded-xl bg-warm-50 border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.phone.trim()}
            className="w-full bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition-colors cursor-pointer mt-2"
          >
            {isEdit ? 'Speichern' : 'Kontakt hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmergencyPage() {
  const { activeChild, state, dispatch } = useApp();
  const [copied, setCopied] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const customContacts = state.emergencyContacts || [];
  const allContacts = [...DEFAULT_CONTACTS, ...customContacts];

  const handleCopy = () => {
    if (!activeChild) return;
    const contactLines = allContacts.map(c => `${c.name}: ${c.phone}`);
    const text = [
      `ALLERGIE-NOTFALLKARTE`,
      `Name: ${activeChild.name}`,
      `Geburtsdatum: ${new Date(activeChild.birthDate).toLocaleDateString('de-DE')}`,
      activeChild.knownAllergies?.length > 0
        ? `Allergien: ${activeChild.knownAllergies.join(', ')}`
        : 'Keine bekannten Allergien',
      '',
      'NOTFALLKONTAKTE:',
      ...contactLines,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveContact = (contact) => {
    const exists = customContacts.find(c => c.id === contact.id);
    if (exists) {
      dispatch({ type: 'UPDATE_EMERGENCY_CONTACT', payload: contact });
    } else {
      dispatch({ type: 'ADD_EMERGENCY_CONTACT', payload: contact });
    }
    setShowAddContact(false);
    setEditingContact(null);
  };

  const handleDeleteContact = (contactId) => {
    dispatch({ type: 'REMOVE_EMERGENCY_CONTACT', payload: contactId });
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
              {activeChild.knownAllergies?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeChild.knownAllergies.map(a => (
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

        {/* Emergency Contacts */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Sofort-Nummern
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            {DEFAULT_CONTACTS.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        </div>

        {/* Doctors */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Kinderärzte & Ärzte
            </h2>
            <button
              onClick={() => setShowAddContact(true)}
              className="flex items-center gap-1 text-xs font-medium text-sage-600 cursor-pointer hover:text-sage-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Hinzufügen
            </button>
          </div>

          {customContacts.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
              {customContacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={(c) => setEditingContact(c)}
                  onDelete={handleDeleteContact}
                />
              ))}
            </div>
          ) : (
            <button
              onClick={() => setShowAddContact(true)}
              className="w-full bg-white rounded-2xl p-5 shadow-sm flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-full bg-sage-50 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-sage-400" />
              </div>
              <p className="text-sm text-gray-500">Kinderarzt hinzufügen</p>
              <p className="text-xs text-gray-400">Immer griffbereit im Notfall</p>
            </button>
          )}
        </div>

        {/* Hint */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
          <Phone className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-700">
            Tippe auf das Telefon-Symbol, um direkt anzurufen. Die Notruf-Nummern sind immer verfügbar.
          </p>
        </div>
      </div>

      {/* Add/Edit Contact Modal */}
      {(showAddContact || editingContact) && (
        <AddContactModal
          contact={editingContact}
          onSave={handleSaveContact}
          onClose={() => { setShowAddContact(false); setEditingContact(null); }}
        />
      )}
    </div>
  );
}
