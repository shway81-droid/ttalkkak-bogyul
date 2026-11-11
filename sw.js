// 서비스 워커: 한 번 열면 인터넷이 끊겨도 쓸 수 있게 화면에 필요한 파일을 모두 담아 둔다.
// 요청은 담아 둔 것으로 먼저 답하고, 뒤에서 새로 받아 갈아 끼운다(stale-while-revalidate).
// 파일을 더하거나 빼면 ASSETS 도 고친다 — tests/sw.test.mjs 가 실제 파일과 맞춰 본다.
// 자료 모양이 바뀌는 큰 변경을 올릴 때는 CACHE 이름의 숫자를 올린다(옛 파일과 섞이지 않게).
const ASSETS = [
  './index.html',
  './print.html',
  './manifest.json',
  './favicon.svg',
  './assets/fonts/LICENSE.txt',
  './assets/fonts/PretendardVariable.subset.woff2',
  './assets/fonts/coverage.txt',
  './css/app.css',
  './css/base.css',
  './css/fonts.css',
  './css/print.css',
  './data/decorate.json',
  './data/drawings.json',
  './data/quiz.json',
  './data/sets.json',
  './data/stories.json',
  './data/words.json',
  './js/activities/celebrate.js',
  './js/activities/draw.js',
  './js/activities/gesture.js',
  './js/activities/greet.js',
  './js/activities/index.js',
  './js/activities/quizboard.js',
  './js/activities/story.js',
  './js/activities/word.js',
  './js/core/data.js',
  './js/core/drawing.js',
  './js/core/flows.js',
  './js/core/plan.js',
  './js/core/rng.js',
  './js/core/rules.js',
  './js/core/script.js',
  './js/core/session.js',
  './js/core/wordTypes.js',
  './js/main.js',
  './js/print.js',
  './js/ui/dom.js',
  './js/ui/guard.js',
  './js/ui/runner.js',
  './js/ui/sfx.js',
  './js/ui/start.js',
];

const CACHE = 'ttalkkak-bogyul-v1';
const PREFIX = 'ttalkkak-bogyul-';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 첫 화면 주소(…/)는 index.html 로, 물음표 뒤(print.html?grade=3)는 떼고 찾는다.
function cacheKey(request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/')) url.pathname += 'index.html';
  url.search = '';
  url.hash = '';
  return url.href;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const key = cacheKey(event.request);
  const cached = await cache.match(key);
  const fresh = fetch(event.request)
    .then((res) => {
      if (res.ok && res.type === 'basic') return cache.put(key, res.clone()).then(() => res);
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  const res = await fresh;
  return res || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // 다른 출처 요청은 건드리지 않는다.
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(staleWhileRevalidate(event));
});
