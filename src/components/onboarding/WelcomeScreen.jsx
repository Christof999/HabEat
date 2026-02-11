import { Baby, Heart, ShieldCheck, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Baby,
    title: 'Mahlzeiten tracken',
    description: 'Fotografiere Mahlzeiten und lasse sie automatisch analysieren.',
  },
  {
    icon: ShieldCheck,
    title: 'Allergien erkennen',
    description: 'Erkenne Muster zwischen Lebensmitteln und Reaktionen.',
  },
  {
    icon: Heart,
    title: 'Berichte erstellen',
    description: 'Generiere Berichte für den Kinderarzt auf Knopfdruck.',
  },
];

export default function WelcomeScreen({ onNext }) {
  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="w-24 h-24 bg-sage-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <span className="text-5xl">🥕</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">HabEat</h1>
        <p className="text-gray-500 text-center text-lg max-w-xs">
          Ernährungstracking für die Gesundheit deines Kindes
        </p>
      </div>

      {/* Features */}
      <div className="px-6 space-y-4 pb-8">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 bg-white rounded-2xl p-4 shadow-sm"
          >
            <div className="w-11 h-11 rounded-xl bg-sage-50 flex items-center justify-center shrink-0">
              <feature.icon className="w-5 h-5 text-sage-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{feature.title}</h3>
              <p className="text-gray-500 text-sm mt-0.5">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-6 pb-10 safe-bottom">
        <button
          onClick={onNext}
          className="w-full bg-sage-500 hover:bg-sage-600 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          Jetzt starten
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
