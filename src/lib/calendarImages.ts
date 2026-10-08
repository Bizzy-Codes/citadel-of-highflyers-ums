// Turns an uploaded calendar into pictures the portal can show inline,
// so pupils and teachers read it on the page itself -- no download, no
// new tab. A PDF is painted page by page exactly as it looks on paper
// (colours, highlights and all); an image is used as it is.

const JPEG_QUALITY = 0.88;
const TARGET_WIDTH = 1500; // px; sharp on a phone, light enough to load quickly

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a picture of the page'))), 'image/jpeg', JPEG_QUALITY);
  });

export const canMakePictures = (fileName: string) => /\.(pdf|png|jpe?g|webp)$/i.test(fileName);

export async function calendarFileToPictures(file: File): Promise<Blob[]> {
  if (/\.(png|jpe?g|webp)$/i.test(file.name) || file.type.startsWith('image/')) {
    return [file];
  }
  if (!/\.pdf$/i.test(file.name)) {
    throw new Error('Only PDF files and pictures can be shown as pictures. For a Word file, use Save As > PDF in Word first.');
  }

  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: Blob[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw the page');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push(await canvasToBlob(canvas));
  }
  return pages;
}
