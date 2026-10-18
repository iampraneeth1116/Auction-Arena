import { toPng } from 'html-to-image';

// Player photos and logos come from other sites. Their image host rejects URLs
// with a query string (so html-to-image's cache-busting breaks it), and a single
// bad image would fail the whole export. So every image is fetched first and
// swapped for a data URL; any that can't be fetched is hidden for the export.

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

async function fetchImageBlob(src) {
  const attempt = async (init) => {
    const res = await fetch(src, { mode: 'cors', ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`not an image: ${blob.type}`);
    return blob;
  };
  // A copy cached from the on-page <img> may lack CORS headers; refetch it once if so
  try {
    return await attempt();
  } catch {
    return attempt({ cache: 'reload' });
  }
}

// Returns a function that un-hides the images that couldn't be inlined
async function inlineImages(root, timeout = 8000) {
  const hidden = [];
  await Promise.all([...root.querySelectorAll('img')].map(async (img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    try {
      img.src = await blobToDataUrl(await withTimeout(fetchImageBlob(src), timeout));
      await img.decode();
    } catch {
      hidden.push([img, img.style.visibility]);
      img.style.visibility = 'hidden';
    }
  }));
  return () => hidden.forEach(([img, visibility]) => { img.style.visibility = visibility; });
}

const download = (dataUrl, fileName) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
};

// Turns an element into a PNG and opens the share sheet, or downloads it where
// sharing files isn't supported. An AbortError means the person closed the sheet.
export async function shareElementAsImage(element, fileName, title) {
  await document.fonts?.ready;
  const restore = await inlineImages(element);
  let dataUrl;
  try {
    dataUrl = await toPng(element, { pixelRatio: 2, cacheBust: false, onImageErrorHandler: () => {} });
  } finally {
    restore();
  }

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return download(dataUrl, fileName);
  try {
    await navigator.share({ files: [file], title });
  } catch (err) {
    // Making the image took longer than the browser's tap-to-share window: save it instead
    if (err?.name === 'NotAllowedError') return download(dataUrl, fileName);
    throw err;
  }
}
