import { supabase } from "../../supabase/client";

const BUCKET = "product-photos";
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function uploadProductPhoto(params: {
  file: File;
  slug: string;
  onProgress?: (p: number) => void;
}): Promise<{ publicUrl: string; path: string }> {
  const { file, slug, onProgress } = params;

  if (!file.type.startsWith("image/")) {
    throw new Error("Only images are allowed");
  }
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    throw new Error("Only JPG or PNG photos are accepted");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Image is too large — please use a file smaller than 20MB");
  }

  const compressedBlob: Blob = await resizeAndCompress(file);
  onProgress?.(20);

  const fileExt = compressedBlob.type === "image/png" ? "png" : "jpg";
  const random = Math.random().toString(36).slice(2, 10);
  const cleanedSlug =
    slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-") || "product";
  const path = `${cleanedSlug}/${Date.now()}-${random}.${fileExt}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(path, compressedBlob, {
    contentType: compressedBlob.type,
    cacheControl: "public, max-age=31536000, immutable",
    upsert: false,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to upload photo");
  }
  onProgress?.(90);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  const publicUrl = urlData.publicUrl;
  onProgress?.(100);

  return { publicUrl, path };
}

export async function deleteProductPhoto(path: string): Promise<void> {
  const fullPath = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path;
  const { error } = await supabase.storage.from(BUCKET).remove([fullPath]);
  if (error) {
    // Not fatal — a stale file doesn't break the UI, but we log for audit.
    console.warn("Failed to remove old product photo:", error.message);
  }
}

async function resizeAndCompress(file: File): Promise<Blob> {
  const bitmap = await loadImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Soft fill so PNG alpha backgrounds don't black out when re-encoded to jpeg
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const quality = type === "image/jpeg" ? JPEG_QUALITY : undefined;
  const blob = await canvas.convertToBlob({ type, quality });
  bitmap.close();

  // Only prefer the compressed version if it's actually smaller.
  if (blob.size < file.size) return blob;
  return await file.arrayBuffer().then((ab) => new Blob([ab], { type: file.type }));
}

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const bitmap = {
        width: canvas.width,
        height: canvas.height,
        close() {},
      } as ImageBitmap;
      resolve(bitmap);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}
