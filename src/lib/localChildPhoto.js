/**
 * Lokale Profilbilder als Data-URL (localStorage / App-State).
 * iPhone-Fotos werden vorher verkleinert und als JPEG komprimiert.
 */

/** Obergrenze für die Data-URL-Zeichenkette (Puffer für größere Kompressionen) */
const MAX_DATA_URL_CHARS = 2_500_000;

const JPEG_MIME = 'image/jpeg';

/**
 * Lädt ein Bild für die Canvas-Zeichnung (createImageBitmap oder Fallback über <img>).
 */
async function loadDrawableImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    return { kind: 'bitmap', source: bitmap };
  } catch {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
        img.src = objectUrl;
      });
      return { kind: 'img', source: img, revoke: objectUrl };
    } catch (e) {
      URL.revokeObjectURL(objectUrl);
      throw e;
    }
  }
}

function getDrawableSize(drawable) {
  if (drawable instanceof ImageBitmap) {
    return { width: drawable.width, height: drawable.height };
  }
  return {
    width: drawable.naturalWidth || drawable.width,
    height: drawable.naturalHeight || drawable.height,
  };
}

/**
 * Zeichnet das Bild auf ein Canvas (max. längere Kante maxSidePx), gibt JPEG-Data-URL zurück.
 */
function drawableToJpegDataUrl(drawable, maxSidePx, quality) {
  const { width, height } = getDrawableSize(drawable);
  if (!width || !height) {
    throw new Error('Ungültige Bildabmessungen.');
  }
  const scale = Math.min(1, maxSidePx / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Vorschau konnte nicht erstellt werden.');
  }
  ctx.drawImage(drawable, 0, 0, w, h);
  return canvas.toDataURL(JPEG_MIME, quality);
}

/**
 * Komprimiert ein Bild für lokale Speicherung: Verkleinern + JPEG-Qualität schrittweise senken.
 */
async function compressImageToDataUrl(file) {
  const loaded = await loadDrawableImage(file);
  const { source, kind, revoke } = loaded;

  try {
    let maxSide = 1600;
    let quality = 0.92;

    for (let attempt = 0; attempt < 48; attempt += 1) {
      const dataUrl = drawableToJpegDataUrl(source, maxSide, quality);
      if (dataUrl.length <= MAX_DATA_URL_CHARS) {
        return dataUrl;
      }
      quality -= 0.05;
      if (quality < 0.42) {
        quality = 0.88;
        maxSide = Math.max(480, Math.floor(maxSide * 0.82));
      }
    }

    throw new Error('Bild ist zu groß – bitte ein anderes Foto wählen.');
  } finally {
    if (kind === 'bitmap') source.close?.();
    if (revoke) URL.revokeObjectURL(revoke);
  }
}

/** Fallback ohne Canvas (selten), nur wenn Datei schon klein genug ist */
function fileToDataUrlRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Ungültiges Bildformat'));
        return;
      }
      if (result.length > MAX_DATA_URL_CHARS) {
        reject(
          new Error(
            'Dieses Bildformat wird hier nicht unterstützt oder ist zu groß. Bitte als JPEG/PNG aufnehmen oder zuschneiden.'
          )
        );
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Öffentliche API: Datei → Data-URL für localStorage (iPhone-tauglich durch Verkleinerung).
 */
export async function fileToDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Bitte wähle eine Bilddatei.');
  }
  try {
    return await compressImageToDataUrl(file);
  } catch (err) {
    console.warn('Bildkompression nicht möglich, Fallback:', err);
    return fileToDataUrlRaw(file);
  }
}

export function isLocalDataUrlPhoto(url) {
  return typeof url === 'string' && url.startsWith('data:image/');
}
