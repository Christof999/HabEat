# HabEat

HabEat ist eine React/Vite-App zur Erfassung von Mahlzeiten und Symptomen bei Kindern.

## Neuer Meal-Gegencheck (API)

Beim Erfassen einer Mahlzeit läuft jetzt ein API-Aufruf über `POST /api/meals/verify`:

1. Primäranalyse des Bilds (KI)
2. Gegencheck mit separater Verifikation
3. Plausibilitätschecks (z. B. Kalorien vs. Makros)
4. Referenzabgleich über OpenFoodFacts API

Die App zeigt danach Vertrauenswert und Prüf-Flags im Review an.

## Setup

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Umgebungsvariablen setzen (z. B. in `.env`):

```bash
GEMINI_API_KEY=dein_gemini_key
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Starten

Frontend + API parallel:

```bash
npm run dev:all
```

Alternativ getrennt:

```bash
npm run api
npm run dev
```
