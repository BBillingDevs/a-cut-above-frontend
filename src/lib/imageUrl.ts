import { RAILWAY_BASE } from "../api/client";

const cache: Record<string, string> = {};

export async function resolveImageUrl(
  url?: string | null,
): Promise<string | null> {
  if (!url) return null;
  // Local dev relative URLs — no presigning needed
  if (url.startsWith("/uploads/")) return url;
  // Already a presigned URL (has X-Amz or similar)
  if (cache[url]) return cache[url];
  try {
    // Extract key from full bucket URL e.g. https://t3.storageapi.dev/bucket-name/products/xxx.jpg
    const pathname = new URL(url).pathname; // /bucket-name/products/xxx.jpg
    const key = pathname.replace(/^\/[^/]+\//, ""); // products/xxx.jpg
    const res = await fetch(
      `${RAILWAY_BASE}/api/image-url?key=${encodeURIComponent(key)}`,
    );
    const data = await res.json();
    cache[url] = data.url;
    return data.url;
  } catch {
    return null;
  }
}
