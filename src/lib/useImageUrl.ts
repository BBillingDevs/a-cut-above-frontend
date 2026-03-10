import { useEffect, useState } from "react";
import { resolveImageUrl } from "./imageUrl";

export function useImageUrl(url?: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveImageUrl(url).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}
