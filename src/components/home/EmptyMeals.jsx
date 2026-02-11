import { UtensilsCrossed } from 'lucide-react';

export default function EmptyMeals() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 bg-sage-50 rounded-full flex items-center justify-center mb-4">
        <UtensilsCrossed className="w-8 h-8 text-sage-300" />
      </div>
      <h3 className="font-semibold text-gray-700 text-lg mb-1">
        Noch keine Mahlzeiten erfasst
      </h3>
      <p className="text-gray-400 text-sm max-w-xs">
        Tippe auf den + Button, um die erste Mahlzeit deines Kindes zu tracken.
      </p>
    </div>
  );
}
