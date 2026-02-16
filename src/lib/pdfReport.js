import { jsPDF } from 'jspdf';

const SYMPTOM_LABELS = {
  skin: 'Haut',
  digestion: 'Verdauung',
  sleep: 'Schlaf',
  mood: 'Stimmung',
  breathing: 'Atmung',
  other: 'Sonstiges',
};

const SEVERITY_LABELS = ['', 'Leicht', 'Mild', 'Mittel', 'Stark', 'Sehr stark'];

const COLORS = {
  primary: [45, 90, 61],     // sage-700
  secondary: [107, 114, 128], // gray-500
  accent: [194, 65, 12],      // warm-700
  danger: [190, 18, 60],      // rose-700
  bg: [249, 250, 251],        // gray-50
  white: [255, 255, 255],
  black: [31, 41, 55],        // gray-800
};

function addHeader(doc, child, pageWidth) {
  // Green header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HabEat', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Ernaehrungsbericht', 14, 20);

  // Child info on right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(child.name, pageWidth - 14, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const birthDate = child.birthDate
    ? new Date(child.birthDate).toLocaleDateString('de-DE')
    : '';
  doc.text(birthDate, pageWidth - 14, 18, { align: 'right' });

  const infoParts = [];
  if (child.height) infoParts.push(`${child.height} cm`);
  if (child.weight) infoParts.push(`${child.weight} kg`);
  if (infoParts.length > 0) {
    doc.text(infoParts.join(' | '), pageWidth - 14, 24, { align: 'right' });
  }

  return 38;
}

function addSectionTitle(doc, y, title, pageWidth) {
  doc.setFillColor(...COLORS.primary);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 18, y + 5.5);
  return y + 12;
}

function checkPageBreak(doc, y, needed, pageHeight) {
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 16;
  }
  return y;
}

async function loadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generatePdfReport(child, meals, symptoms, correlation, growthEntries = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 28;

  let y = addHeader(doc, child, pageWidth);

  // Allergies
  if (child.knownAllergies?.length > 0) {
    doc.setFillColor(255, 241, 242); // rose-50
    doc.roundedRect(14, y, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(...COLORS.danger);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Bekannte Allergien: ' + child.knownAllergies.join(', '), 18, y + 6.5);
    y += 14;
  }

  // Report date
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 14, y);
  y += 8;

  // --- MEALS SECTION ---
  y = addSectionTitle(doc, y, `MAHLZEITEN (${meals.length})`, pageWidth);

  if (meals.length === 0) {
    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(8);
    doc.text('Noch keine Mahlzeiten erfasst.', 14, y + 4);
    y += 10;
  }

  for (const meal of meals) {
    y = checkPageBreak(doc, y, 20, pageHeight);

    // Meal row background
    doc.setFillColor(...COLORS.bg);
    doc.roundedRect(14, y, contentWidth, 14, 1.5, 1.5, 'F');

    // Time
    const mealDate = new Date(meal.timestamp);
    const dateStr = mealDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const timeStr = mealDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(7);
    doc.text(`${dateStr} ${timeStr}`, 17, y + 5);

    // Title
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(meal.title || 'Unbenannt', 46, y + 5);

    // Calories
    if (meal.calories) {
      doc.setTextColor(...COLORS.accent);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`${meal.calories} kcal`, pageWidth - 14, y + 5, { align: 'right' });
    }

    // Ingredients
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(7);
    if (meal.ingredients?.length > 0) {
      const ingredientText = meal.ingredients.join(', ');
      const truncated = ingredientText.length > 80 ? ingredientText.slice(0, 80) + '...' : ingredientText;
      doc.text(truncated, 17, y + 11);
    }

    // Allergen warning
    if (meal.allergens?.length > 0) {
      doc.setTextColor(...COLORS.danger);
      doc.setFontSize(6);
      const allergenX = meal.ingredients?.length > 0 ? 17 + doc.getTextWidth(
        (meal.ingredients.join(', ').length > 80
          ? meal.ingredients.join(', ').slice(0, 80) + '...'
          : meal.ingredients.join(', ')) + '  '
      ) : 17;
      doc.text(`! ${meal.allergens.join(', ')}`, Math.min(allergenX, pageWidth - 50), y + 11);
    }

    y += 17;
  }

  y += 4;

  // --- SYMPTOMS SECTION ---
  y = checkPageBreak(doc, y, 20, pageHeight);
  y = addSectionTitle(doc, y, `SYMPTOME (${symptoms.length})`, pageWidth);

  if (symptoms.length === 0) {
    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(8);
    doc.text('Noch keine Symptome erfasst.', 14, y + 4);
    y += 10;
  }

  for (const symptom of symptoms) {
    const hasPhoto = symptom.photoUrl || symptom.photoStorageUrl;
    const neededHeight = hasPhoto ? 42 : 18;
    y = checkPageBreak(doc, y, neededHeight, pageHeight);

    // Symptom row background
    doc.setFillColor(...COLORS.bg);
    const rowHeight = hasPhoto ? 40 : 14;
    doc.roundedRect(14, y, contentWidth, rowHeight, 1.5, 1.5, 'F');

    // Time
    const sDate = new Date(symptom.timestamp);
    const sDateStr = sDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const sTimeStr = sDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(7);
    doc.text(`${sDateStr} ${sTimeStr}`, 17, y + 5);

    // Type
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(SYMPTOM_LABELS[symptom.type] || symptom.type, 46, y + 5);

    // Severity
    doc.setTextColor(...COLORS.accent);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${SEVERITY_LABELS[symptom.severity] || symptom.severity} (${symptom.severity}/5)`,
      pageWidth - 14, y + 5, { align: 'right' }
    );

    // Notes
    if (symptom.notes) {
      doc.setTextColor(...COLORS.secondary);
      doc.setFontSize(7);
      const truncatedNotes = symptom.notes.length > 100 ? symptom.notes.slice(0, 100) + '...' : symptom.notes;
      doc.text(truncatedNotes, 17, y + 11);
    }

    // Photo
    if (hasPhoto) {
      const photoSrc = symptom.photoUrl || symptom.photoStorageUrl;
      try {
        // For storage URLs, fetch the image first
        const imgData = photoSrc.startsWith('data:')
          ? photoSrc
          : await loadImageAsBase64(photoSrc);

        if (imgData) {
          doc.addImage(imgData, 'JPEG', 17, y + 14, 24, 24, undefined, 'MEDIUM');
          // Label next to photo
          doc.setTextColor(...COLORS.secondary);
          doc.setFontSize(6);
          doc.text('Foto-Dokumentation', 44, y + 20);
        }
      } catch {
        doc.setTextColor(...COLORS.secondary);
        doc.setFontSize(6);
        doc.text('[Foto konnte nicht geladen werden]', 17, y + 18);
      }
    }

    y += rowHeight + 3;
  }

  y += 4;

  // --- GROWTH SECTION ---
  const childGrowth = growthEntries
    .filter(e => e.childId === child.id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (childGrowth.length > 0) {
    y = checkPageBreak(doc, y, 20, pageHeight);
    y = addSectionTitle(doc, y, `WACHSTUMSVERLAUF (${childGrowth.length} Messungen)`, pageWidth);

    // Table header
    doc.setFillColor(229, 231, 235); // gray-200
    doc.roundedRect(14, y, contentWidth, 8, 1, 1, 'F');
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Datum', 17, y + 5.5);
    doc.text('Groesse (cm)', 60, y + 5.5);
    doc.text('Gewicht (kg)', 100, y + 5.5);
    doc.text('BMI', 140, y + 5.5);
    y += 10;

    for (const entry of childGrowth) {
      y = checkPageBreak(doc, y, 8, pageHeight);

      doc.setFillColor(...COLORS.bg);
      doc.roundedRect(14, y, contentWidth, 7, 1, 1, 'F');

      const gDate = new Date(entry.timestamp);
      doc.setTextColor(...COLORS.secondary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(gDate.toLocaleDateString('de-DE'), 17, y + 5);

      doc.setTextColor(...COLORS.black);
      doc.text(entry.height ? `${entry.height}` : '—', 60, y + 5);
      doc.text(entry.weight ? `${entry.weight}` : '—', 100, y + 5);

      if (entry.weight && entry.height) {
        const bmi = (entry.weight / ((entry.height / 100) ** 2)).toFixed(1);
        doc.text(bmi, 140, y + 5);
      } else {
        doc.text('—', 140, y + 5);
      }

      y += 9;
    }

    // Weight trend alert
    if (childGrowth.length >= 2) {
      const latest = childGrowth[childGrowth.length - 1];
      const first = childGrowth[0];
      if (latest.weight && first.weight) {
        const change = ((latest.weight - first.weight) / first.weight * 100).toFixed(1);
        y += 2;
        doc.setTextColor(change < 0 ? COLORS.danger[0] : COLORS.primary[0],
                         change < 0 ? COLORS.danger[1] : COLORS.primary[1],
                         change < 0 ? COLORS.danger[2] : COLORS.primary[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `Gewichtsentwicklung: ${change > 0 ? '+' : ''}${change}% (${first.weight} kg → ${latest.weight} kg)`,
          17, y + 4
        );
        y += 8;
      }
    }

    y += 4;
  }

  // --- DETECTIVE RESULTS ---
  if (correlation?.suspects?.length > 0) {
    y = checkPageBreak(doc, y, 20, pageHeight);
    y = addSectionTitle(doc, y, 'DETEKTIV-ERGEBNISSE', pageWidth);

    for (const suspect of correlation.suspects) {
      y = checkPageBreak(doc, y, 12, pageHeight);

      doc.setFillColor(...COLORS.bg);
      doc.roundedRect(14, y, contentWidth, 10, 1.5, 1.5, 'F');

      doc.setTextColor(...COLORS.black);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(suspect.name, 17, y + 6);

      // Confidence
      const confColor = suspect.confidence >= 70 ? COLORS.danger
        : suspect.confidence >= 40 ? COLORS.accent : COLORS.primary;
      doc.setTextColor(...confColor);
      doc.setFontSize(8);
      doc.text(`${suspect.confidence}%`, pageWidth - 14, y + 6, { align: 'right' });

      // Confidence bar
      const barWidth = 30;
      const barX = pageWidth - 14 - barWidth - 16;
      doc.setFillColor(229, 231, 235); // gray-200
      doc.roundedRect(barX, y + 3, barWidth, 3, 1, 1, 'F');
      doc.setFillColor(...confColor);
      doc.roundedRect(barX, y + 3, barWidth * (suspect.confidence / 100), 3, 1, 1, 'F');

      y += 13;
    }

    y += 4;
  }

  // --- DISCLAIMER ---
  y = checkPageBreak(doc, y, 20, pageHeight);
  doc.setFillColor(224, 242, 254); // sky-100
  doc.roundedRect(14, y, contentWidth, 16, 2, 2, 'F');
  doc.setTextColor(3, 105, 161); // sky-700
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Wichtiger Hinweis', 18, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const disclaimerLines = doc.splitTextToSize(
    'Dies ist keine medizinische Diagnose. Die Analyse basiert auf statistischen Mustern und KI-Vermutungen. ' +
    'Bitte besprich alle Beobachtungen mit deinem Kinderarzt, bevor du Lebensmittel aus der Ernaehrung streichst.',
    contentWidth - 8
  );
  doc.text(disclaimerLines, 18, y + 9);

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setTextColor(...COLORS.secondary);
    doc.setFontSize(6);
    doc.text(
      `HabEat Bericht - ${child.name} - Seite ${i}/${totalPages}`,
      pageWidth / 2, pageHeight - 8, { align: 'center' }
    );
  }

  // Save
  const filename = `HabEat_${child.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
