/** Output target once encoded to base64 data URL. */
export const POST_IMAGE_MAX_BYTES = 1_000_000;
/** Max raw file picked from disk before optimization starts. */
export const POST_IMAGE_INPUT_MAX_BYTES = 8_000_000;

const MAX_DIMENSION = 1600;
const ALLOWED_TYPES = /^image\/(png|jpe?g|webp|gif)$/i;

function dataUrlByteLength(dataUrl: string) {
  const payload = dataUrl.split(",")[1] ?? "";
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.startsWith("data:image/")) {
        reject(new Error("Could not read image."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = dataUrl;
  });
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: "image/webp" | "image/jpeg" | "image/png",
  quality = 0.86
) {
  return canvas.toDataURL(mime, mime === "image/png" ? undefined : quality);
}

export async function fileToPostImageDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.test(file.type)) {
    throw new Error("Use PNG, JPG, WebP, or GIF.");
  }
  if (file.size > POST_IMAGE_INPUT_MAX_BYTES) {
    throw new Error("Image is too large. Pick one under 8 MB.");
  }

  const original = await readAsDataUrl(file);

  // Keep GIF untouched to avoid dropping animation frames.
  if (/^image\/gif$/i.test(file.type)) {
    if (dataUrlByteLength(original) > POST_IMAGE_MAX_BYTES) {
      throw new Error("GIF is too large. Use a smaller GIF (under 1 MB).");
    }
    return original;
  }

  const img = await loadImage(original);
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  const firstScale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * firstScale));
  height = Math.max(1, Math.round(height * firstScale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");

  const mimes: Array<"image/webp" | "image/jpeg" | "image/png"> = [
    "image/webp",
    "image/jpeg",
    "image/png",
  ];

  for (let pass = 0; pass < 6; pass++) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const mime of mimes) {
      const qualities =
        mime === "image/png" ? [1] : [0.86, 0.8, 0.74, 0.68, 0.62];
      for (const quality of qualities) {
        const encoded = encodeCanvas(canvas, mime, quality);
        if (dataUrlByteLength(encoded) <= POST_IMAGE_MAX_BYTES) {
          return encoded;
        }
      }
    }

    // Still too large: downscale and retry.
    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
  }

  throw new Error("Image stays too large after compression. Try a smaller one.");
}
