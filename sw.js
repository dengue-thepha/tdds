/**
 * TDDS Service Worker - PWA Cache Strategy
 * ระบบบันทึกข้อมูลไข้เลือดออก อ.เทพา จ.สงขลา
 *
 * กลยุทธ์การ Cache:
 *  - index.html          → Network-first (อัพเดตเสมอถ้ามีเน็ต, ใช้ cache ถ้าไม่มี)
 *  - CDN scripts/styles  → Cache-first + background update (Stale-While-Revalidate)
 *  - Google Fonts        → Cache-first (ไม่เปลี่ยนบ่อย)
 *  - Supabase API calls  → Network-only (ข้อมูล real-time ไม่ cache)
 *  - Tile maps (OSM)     → Cache-first with 7-day expiry
 */

const CACHE_VERSION = 'v1.2';
const STATIC_CACHE  = `tdds-static-${CACHE_VERSION}`;
const CDN_CACHE     = `tdds-cdn-${CACHE_VERSION}`;
const FONT_CACHE    = `tdds-fonts-${CACHE_VERSION}`;
const TILE_CACHE    = `tdds-tiles-${CACHE_VERSION}`;

// ไฟล์ที่ต้อง pre-cache ทันทีเมื่อติดตั้ง SW
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

// CDN URLs ที่ต้อง cache (scripts & styles)
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
];

// Domains ที่เป็น API → ห้าม cache
const NO_CACHE_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'supabase.com',
  'api.telegram.org',
];

// Max age สำหรับ map tiles (7 วัน)
const TILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Max age สำหรับ CDN (30 วัน)
const CDN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================
// INSTALL - Pre-cache ไฟล์สำคัญ
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing TDDS Service Worker', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching static assets...');
      // addAll แต่ทำ try-catch ทีละไฟล์เพื่อไม่ให้ล้มเหลวทั้งหมด
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW] Pre-cache miss for:', url, err.message)
          )
        )
      );
    }).then(() => {
      // Pre-cache CDN assets in background
      return caches.open(CDN_CACHE).then((cache) => {
        return Promise.allSettled(
          CDN_URLS.map((url) =>
            fetch(url, { mode: 'cors' })
              .then((res) => {
                if (res.ok) cache.put(url, res.clone());
              })
              .catch((err) =>
                console.warn('[SW] CDN pre-cache miss:', url, err.message)
              )
          )
        );
      });
    }).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting(); // เปิดใช้งาน SW ใหม่ทันที
    })
  );
});

// ============================================================
// ACTIVATE - ลบ cache เวอร์ชั่นเก่า
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating TDDS Service Worker', CACHE_VERSION);
  const CURRENT_CACHES = [STATIC_CACHE, CDN_CACHE, FONT_CACHE, TILE_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('tdds-') && !CURRENT_CACHES.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete, claiming clients...');
      return self.clients.claim(); // ควบคุม tab ที่เปิดอยู่ทันที
    })
  );
});

// ============================================================
// FETCH - Intercept requests
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ข้ามคำขอที่ไม่ใช่ GET
  if (request.method !== 'GET') return;

  // ข้ามคำขอไปยัง API domains (Supabase, Telegram)
  if (NO_CACHE_DOMAINS.some((d) => url.hostname.includes(d))) {
    return; // Network-only
  }

  // ============================================================
  // 1. Map Tiles (OpenStreetMap) → Cache-first + expiry
  // ============================================================
  if (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tiles.stadiamaps.com') ||
    url.hostname.includes('mt0.google.com') ||
    url.hostname.includes('mt1.google.com') ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/) && url.hostname.includes('tile')
  ) {
    event.respondWith(cacheFirstWithExpiry(request, TILE_CACHE, TILE_MAX_AGE_MS));
    return;
  }

  // ============================================================
  // 2. Google Fonts → Cache-first (ไม่ค่อยเปลี่ยน)
  // ============================================================
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // ============================================================
  // 3. CDN Scripts & Styles → Stale-While-Revalidate
  // ============================================================
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.tailwindcss.com')
  ) {
    event.respondWith(staleWhileRevalidate(request, CDN_CACHE, CDN_MAX_AGE_MS));
    return;
  }

  // ============================================================
  // 4. index.html และไฟล์ local → Network-first
  // ============================================================
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname === '' ||
    url.hostname === location.hostname
  ) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // ============================================================
  // 5. ทั้งหมดที่เหลือ → Network-first fallback
  // ============================================================
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ============================================================
// HELPER STRATEGIES
// ============================================================

/**
 * Network-first: ลองดึงจากเน็ตก่อน ถ้าไม่มีใช้ cache
 */
async function networkFirst(request, cacheName) {
  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Offline fallback from cache:', request.url);
      return cached;
    }
    // ถ้าไม่มี cache เลย → ส่ง offline page
    return offlineFallback();
  }
}

/**
 * Cache-first: ใช้ cache ก่อน ถ้าไม่มีดึงจากเน็ต
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch (err) {
    console.warn('[SW] Cache-first fetch failed:', request.url, err.message);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Cache-first with expiry: ใช้ cache แต่เช็คอายุ
 */
async function cacheFirstWithExpiry(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const dateHeader = cached.headers.get('date');
    if (dateHeader) {
      const ageMs = Date.now() - new Date(dateHeader).getTime();
      if (ageMs < maxAgeMs) return cached;
    } else {
      // ไม่มี date header → ใช้ cache ไปก่อน
      return cached;
    }
  }

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    if (cached) return cached; // ถ้า expired แต่ไม่มีเน็ต → ใช้ cache เก่าได้
    return new Response('Tile unavailable offline', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: ตอบ cache ทันที + อัพเดต background
 */
async function staleWhileRevalidate(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // อัพเดต cache ใน background เสมอ (ไม่ await)
  const fetchPromise = fetch(request)
    .then((networkRes) => {
      if (networkRes.ok) {
        cache.put(request, networkRes.clone());
      }
      return networkRes;
    })
    .catch(() => null);

  if (cached) {
    // ตรวจอายุ — ถ้าเกิน maxAge ให้รอ network แทน
    const dateHeader = cached.headers.get('date');
    if (dateHeader) {
      const ageMs = Date.now() - new Date(dateHeader).getTime();
      if (ageMs < maxAgeMs) return cached; // ยังสดอยู่ → ส่ง cache
    } else {
      return cached; // ไม่รู้อายุ → ส่ง cache ไปก่อน
    }
  }

  // cache หมดอายุหรือไม่มี → รอ network
  const networkRes = await fetchPromise;
  if (networkRes) return networkRes;
  if (cached) return cached; // fallback ถ้า network ล้มเหลว
  return new Response('Resource unavailable', { status: 503 });
}

/**
 * Offline fallback page (HTML inline)
 */
function offlineFallback() {
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TDDS - ออฟไลน์</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Kanit', -apple-system, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
    }
    .icon { font-size: 5rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; color: #26A69A; }
    p  { font-size: 0.95rem; color: #94a3b8; line-height: 1.6; max-width: 320px; }
    .retry-btn {
      margin-top: 2rem;
      background: #26A69A;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-family: inherit;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    }
    .retry-btn:hover { background: #2bbbad; }
    .badge {
      margin-top: 1rem;
      font-size: 0.75rem;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="icon">📡</div>
  <h1>ไม่มีสัญญาณอินเทอร์เน็ต</h1>
  <p>ไม่สามารถโหลดแอปพลิเคชัน TDDS ได้ในขณะนี้<br>
     กรุณาตรวจสอบสัญญาณเครือข่ายแล้วลองใหม่อีกครั้ง</p>
  <button class="retry-btn" onclick="window.location.reload()">🔄 ลองใหม่</button>
  <p class="badge">TDDS - ระบบบันทึกข้อมูลไข้เลือดออก อ.เทพา</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

// ============================================================
// MESSAGE - รับคำสั่งจาก app (เช่น force update, clear cache)
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('tdds-')).map((k) => caches.delete(k)))
    ).then(() => {
      event.ports[0]?.postMessage({ success: true });
      console.log('[SW] All TDDS caches cleared');
    });
  }
});
