export interface CachedSprite {
  canvas: HTMLCanvasElement | HTMLImageElement;
  dataUrl: string;
  width: number;
  height: number;
}

interface WxImageGlobals {
  createImage?: () => HTMLImageElement;
}

function getWxCreateImage(): (() => HTMLImageElement) | null {
  const wxObj = (globalThis as unknown as { wx?: WxImageGlobals }).wx;
  return typeof wxObj?.createImage === 'function' ? wxObj.createImage : null;
}

interface StoredSpriteRecord {
  key: string;
  url: string;
  dataUrl: string;
  width: number;
  height: number;
}

const DB_NAME = 'clash_of_realms_sprite_cache_v1';
const STORE_NAME = 'sprites';
const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [300, 800, 1800, 3500];

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openSpriteDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function readCachedRecord(key: string): Promise<StoredSpriteRecord | null> {
  const db = await openSpriteDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as StoredSpriteRecord) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeCachedRecord(record: StoredSpriteRecord): Promise<void> {
  const db = await openSpriteDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function imageToCachedSprite(img: HTMLImageElement, existingDataUrl?: string): CachedSprite | null {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let dataUrl = existingDataUrl;
  if (!dataUrl) {
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      dataUrl = img.src;
    }
  }
  return { canvas, dataUrl, width: w, height: h };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => undefined);
        }
      } finally {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

export function createSpriteRegistry<K extends string>(
  namespace: string,
  urls: Record<K, string>
) {
  const cache = new Map<K, CachedSprite>();
  const inFlight = new Set<K>();
  const retryCount = new Map<K, number>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const fn of listeners) fn();
  };

  const loadOne = async (key: K) => {
    const wxCreateImage = getWxCreateImage();
    if (typeof window === 'undefined' && !wxCreateImage) return;
    if (cache.has(key) || inFlight.has(key)) return;
    inFlight.add(key);

    const url = urls[key];
    const dbKey = `${namespace}:${key}`;

    try {
      // 0. WeChat Mini Game runtime: load local packaged PNGs directly via wx.createImage()
      if (wxCreateImage && (typeof document === 'undefined' || typeof window === 'undefined')) {
        const wxImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = wxCreateImage();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load wx sprite: ${url}`));
          img.src = url;
        });
        const w = wxImg.naturalWidth || wxImg.width;
        const h = wxImg.naturalHeight || wxImg.height;
        if (w > 0 && h > 0) {
          cache.set(key, { canvas: wxImg, dataUrl: url, width: w, height: h });
          retryCount.delete(key);
          inFlight.delete(key);
          notify();
          return;
        }
        throw new Error(`Empty wx sprite dimensions for ${key}`);
      }

      // 1. Try persistent local IndexedDB cache first for instant restore without network dependency
      const stored = await readCachedRecord(dbKey);
      if (stored && stored.url === url && stored.dataUrl.startsWith('data:image/')) {
        try {
          const cachedImg = await loadImageElement(stored.dataUrl);
          const sprite = imageToCachedSprite(cachedImg, stored.dataUrl);
          if (sprite) {
            cache.set(key, sprite);
            inFlight.delete(key);
            retryCount.delete(key);
            notify();
            return;
          }
        } catch {
          // Fall through to network fetch if cached dataUrl is corrupt
        }
      }

      // 2. Fetch pre-baked transparent PNG asset (with cache-bust on retries)
      const attempt = retryCount.get(key) ?? 0;
      const fetchUrl =
        attempt > 0
          ? `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}`
          : url;

      const img = await loadImageElement(fetchUrl);
      const sprite = imageToCachedSprite(img);
      if (sprite) {
        cache.set(key, sprite);
        retryCount.delete(key);
        inFlight.delete(key);
        notify();
        void writeCachedRecord({
          key: dbKey,
          url,
          dataUrl: sprite.dataUrl,
          width: sprite.width,
          height: sprite.height,
        });
        return;
      }
      throw new Error(`Empty sprite dimensions for ${key}`);
    } catch {
      inFlight.delete(key);
      const attempt = retryCount.get(key) ?? 0;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        retryCount.set(key, attempt + 1);
        globalThis.setTimeout(() => {
          void loadOne(key);
        }, delay);
      }
    }
  };

  const preloadAll = () => {
    if (typeof window === 'undefined' && !getWxCreateImage()) return;
    (Object.keys(urls) as K[]).forEach((k) => {
      if (!cache.has(k) && !inFlight.has(k)) {
        void loadOne(k);
      }
    });
  };

  const getSprite = (key: K): CachedSprite | null => {
    const hit = cache.get(key);
    if (hit) return hit;
    if ((typeof window !== 'undefined' || Boolean(getWxCreateImage())) && !inFlight.has(key)) {
      void loadOne(key);
    }
    return null;
  };

  const subscribe = (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  return {
    urls,
    preloadAll,
    getSprite,
    subscribe,
  };
}
