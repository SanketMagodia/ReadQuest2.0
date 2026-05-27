/**
 * Client-side helpers for handling user-uploaded avatar files.
 *
 * Avatars are downscaled and re-encoded in the browser before being sent to
 * the server, so we never push multi-MB camera photos through the API. The
 * result is a data: URL (base64 JPEG) suitable for storing directly on the
 * User document.
 */

export const AVATAR_MAX_DIMENSION = 512;
export const AVATAR_JPEG_QUALITY = 0.85;
export const AVATAR_MAX_BYTES = 1_500_000; // ~1.5 MB cap on output data URL

export type ResizeResult = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
};

/** Read a File as a data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Load an HTMLImageElement from a URL. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

/**
 * Resize an uploaded image to a square, cover-fit JPEG.
 * Throws if the file is not an image, fails to decode, or the encoded result
 * exceeds AVATAR_MAX_BYTES.
 */
export async function resizeAvatar(file: File): Promise<ResizeResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPEG, WebP).");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("That image is too large (max 25 MB).");
  }

  const initialUrl = await readFileAsDataUrl(file);
  const img = await loadImage(initialUrl);

  const target = AVATAR_MAX_DIMENSION;
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");

  // Cover-fit: scale so the shortest side matches `target`, then center-crop.
  const scale = Math.max(target / img.width, target / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (target - drawW) / 2;
  const dy = (target - drawH) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target, target);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const dataUrl = canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY);
  // Rough size in bytes: every 4 chars of base64 = 3 bytes; ignore the header overhead.
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Math.floor((base64.length * 3) / 4);

  if (bytes > AVATAR_MAX_BYTES) {
    throw new Error(
      "Image is still too big after compression — try a smaller picture."
    );
  }

  return { dataUrl, width: target, height: target, bytes };
}
