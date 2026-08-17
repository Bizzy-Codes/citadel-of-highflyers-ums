// Downscales/re-encodes an image client-side until it fits under
// targetBytes, instead of just rejecting large photos outright (most
// phone camera photos are well over a few MB). Tries progressively
// lower JPEG quality first, then progressively smaller dimensions, and
// gives up with whatever's smallest if it still can't hit the target.
export async function compressImageToTarget(file: File, targetBytes: number, maxDimension = 1600): Promise<File> {
  const bitmap = await loadImage(file);
  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  let quality = 0.9;
  let blob = await drawToBlob(bitmap, width, height, quality);

  while (blob.size > targetBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await drawToBlob(bitmap, width, height, quality);
  }

  while (blob.size > targetBytes && (width > 400 || height > 400)) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    blob = await drawToBlob(bitmap, width, height, 0.7);
  }

  const name = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

function drawToBlob(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', quality);
  });
}
