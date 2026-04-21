/**
 * Konvertiert ein Bild zu einer Data-URL für lokale Speicherung (localStorage / App-State).
 * Kein Cloud-Upload.
 */
const MAX_DATA_URL_CHARS = 900_000;

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Ungültiges Bildformat'));
        return;
      }
      if (result.length > MAX_DATA_URL_CHARS) {
        reject(new Error('Bild ist zu groß für die lokale Speicherung (max. ca. 600 KB).'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

export function isLocalDataUrlPhoto(url) {
  return typeof url === 'string' && url.startsWith('data:image/');
}
