import { useEffect, useState } from 'react';
import { getPhotoUrls } from '../../lib/spotlight';

// Loads (signed) links for the photos in a round and keeps them fresh.
export function usePhotoUrls(paths: (string | null)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).join('|');
  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) return;
    let cancelled = false;
    getPhotoUrls(list).then((map) => { if (!cancelled) setUrls((prev) => ({ ...prev, ...map })); });
    return () => { cancelled = true; };
  }, [key]);
  return urls;
}
