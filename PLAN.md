# Plan: Symptom-Fotos + PDF-Bericht

## Phase 1: Foto-Capture im SymptomLogger
- Optionaler "Foto hinzufuegen"-Button im SymptomLogger (nach Typ-Auswahl)
- Kamera + Galerie-Auswahl (gleiche UX wie bei Mahlzeiten)
- Bildvorschau im Logger vor dem Speichern
- Bild-Komprimierung via Canvas (max ~800px Breite) um Speicher zu sparen
- Neues Feld `photoUrl` im Symptom-Objekt (base64 lokal)

## Phase 2: Firebase Storage fuer Symptom-Fotos
- Upload-Funktion: `uploadSymptomPhoto(username, symptomId, base64)`
  -> speichert unter `users/{username}/symptoms/{id}.jpg`
- Download-URL wird als `photoStorageUrl` im Firestore-Symptom gespeichert
- Beim Laden: Bild von Firebase Storage holen (nicht base64 in Firestore!)
- Vorteil: Fotos sind geraetuebergreifend verfuegbar + im Bericht nutzbar

## Phase 3: Foto-Anzeige
- SymptomDetailModal: Foto gross oben anzeigen (wie bei MealDetailModal)
- SymptomHistoryPage: Kleines Kamera-Icon bei Symptomen die ein Foto haben
- Symptom-Karten: Optional Thumbnail

## Phase 4: PDF-Bericht mit Bildern
- Neue Bibliothek: `jspdf` (clientseitig, kein Server noetig)
- Ersetzt/ergaenzt den aktuellen TXT-Export in den Einstellungen
- Bericht-Inhalt:
  - Header: Kind-Infos, Allergien, Zeitraum
  - Mahlzeiten-Sektion (mit Fotos falls vorhanden)
  - Symptom-Sektion (mit Fotos, Schweregrad, Beschreibung, Uhrzeit)
  - Detektiv-Ergebnisse (Top-Verdaechtige, Korrelationen)
  - Disclaimer
- Professionelles Layout fuer die Kinderaerztin

## Reihenfolge & Abhaengigkeiten
Phase 1 + 2 koennen zusammen umgesetzt werden (Capture + Storage)
Phase 3 haengt von Phase 1+2 ab (Anzeige braucht Daten)
Phase 4 ist unabhaengig aber profitiert von Phase 2 (Storage-URLs fuer Bilder)

## Technische Entscheidungen
- Firebase Storage statt nur localStorage -> Fotos geraetuebergreifend verfuegbar
- Bild-Komprimierung clientseitig -> spart Upload-Zeit und Speicher
- jspdf statt Server-PDF -> funktioniert offline, keine Backend-Kosten
- Symptom-Fotos optional -> nicht jedes Symptom braucht ein Foto
