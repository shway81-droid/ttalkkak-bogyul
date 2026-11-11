// 서비스 워커: 한 번 열면 인터넷이 끊겨도 쓸 수 있게 화면에 필요한 파일을 모두 담아 둔다.
// 요청은 담아 둔 것으로 먼저 답하고, 뒤에서 새로 받아 갈아 끼운다(stale-while-revalidate).
// 파일을 더하거나 빼면 ASSETS 도 고친다 — tests/sw.test.mjs 가 실제 파일과 맞춰 본다.
// CACHE 이름 끝은 ASSETS 파일 내용의 해시다. 파일을 하나라도 바꾸면 `npm run stamp` 로 새로 찍는다
// (검사가 알려 준다). 그러면 배포 뒤 이 파일이 바뀌어 브라우저가 서비스 워커를 새로 설치하고,
// 모든 파일을 한꺼번에 새로 받아 옛 파일과 새 파일이 섞이지 않는다.
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

const CACHE = 'ttalkkak-bogyul-4bce02504af2';
const PREFIX = 'ttalkkak-bogyul-';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 브라우저 HTTP 캐시(GitHub Pages 는 10분)를 거치지 않고 서버에서 새로 받는다
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(new URL(u, self.location), { cache: 'reload' }))))
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
