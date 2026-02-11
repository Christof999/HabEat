import { ArrowRight, Plus, Check, Trash2 } from 'lucide-react';

export default function OnboardingSummary({ children, onAddAnother, onComplete, onRemoveChild }) {
  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-sage-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Fast geschafft!</h2>
        <p className="text-gray-500 mt-1">
          {children.length === 1
            ? 'Du hast ein Kind hinzugefügt. Möchtest du weitere hinzufügen?'
            : `Du hast ${children.length} Kinder hinzugefügt. Alles korrekt?`}
        </p>
      </div>

      {/* Children List */}
      <div className="flex-1 px-6 space-y-3">
        {children.map(child => (
          <div
            key={child.id}
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4"
          >
            <div className={`w-14 h-14 rounded-full ${child.avatarColor} flex items-center justify-center shrink-0`}>
              <span className="text-xl font-bold text-gray-700">
                {child.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800">{child.name}</h3>
              <p className="text-sm text-gray-500">
                Geb. {new Date(child.birthDate).toLocaleDateString('de-DE')}
                {child.height && ` · ${child.height} cm`}
                {child.weight && ` · ${child.weight} kg`}
              </p>
              {child.knownAllergies.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {child.knownAllergies.map(a => (
                    <span
                      key={a}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onRemoveChild(child.id)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Add Another Button */}
        <button
          onClick={onAddAnother}
          className="w-full border-2 border-dashed border-sage-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-sage-600 hover:border-sage-400 hover:bg-sage-50 transition cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Weiteres Kind hinzufügen</span>
        </button>
      </div>

      {/* CTA */}
      <div className="px-6 py-8 safe-bottom">
        <button
          onClick={onComplete}
          className="w-full bg-sage-500 hover:bg-sage-600 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          Los geht's!
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
