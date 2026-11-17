// 서비스 워커: 한 번 열면 인터넷이 끊겨도 쓸 수 있게 화면에 필요한 파일을 모두 담아 둔다.
// 화면 파일(ASSETS)과 인물 사진(PHOTOS)은 캐시를 따로 쓴다.
// - 화면 파일: 담아 둔 것으로 먼저 답하고 뒤에서 새로 받아 갈아 끼운다(stale-while-revalidate).
//   설치할 때 한꺼번에 받는다(addAll — 하나라도 실패하면 설치 실패, 옛 파일과 새 파일이 섞이지 않게).
// - 인물 사진: 내용이 바뀌면 사진 캐시 이름이 바뀌므로 담아 둔 것을 그대로 쓴다(cache-first).
//   한 장씩 받아 실패한 사진만 빠지고(불안정한 와이파이에서도 설치는 됨), 빠진 사진은 다음에 열 때 다시 받는다.
//   화면 파일만 바뀐 배포에서는 사진 캐시 이름이 그대로라 사진(약 3MB)을 다시 받지 않는다.
// ASSETS·PHOTOS·CACHE·PHOTO_CACHE 는 `npm run stamp` 가 쓴다. 화면 파일·사진을 더하거나 빼거나 바꾸면 다시 돌린다
// (tests/sw.test.mjs 가 알려 준다). 캐시 이름 끝은 각 목록 파일 내용의 해시다.
const ASSETS = [
  './index.html',
  './answer.html',
  './credits.html',
  './print.html',
  './manifest.json',
  './favicon.svg',
  './assets/fonts/LICENSE.txt',
  './assets/fonts/PretendardVariable.subset.woff2',
  './assets/fonts/coverage.txt',
  './assets/icons/LICENSE.txt',
  './css/answer.css',
  './css/app.css',
  './css/base.css',
  './css/credits.css',
  './css/fonts.css',
  './css/print.css',
  './data/people.json',
  './data/quiz.json',
  './data/sets.json',
  './data/stories.json',
  './data/words.json',
  './js/activities/celebrate.js',
  './js/activities/gesture.js',
  './js/activities/greet.js',
  './js/activities/index.js',
  './js/activities/quizboard.js',
  './js/activities/story.js',
  './js/activities/word.js',
  './js/answer.js',
  './js/core/data.js',
  './js/core/flows.js',
  './js/core/license.js',
  './js/core/plan.js',
  './js/core/rng.js',
  './js/core/rules.js',
  './js/core/script.js',
  './js/core/session.js',
  './js/core/wordTypes.js',
  './js/credits.js',
  './js/main.js',
  './js/print.js',
  './js/single.js',
  './js/ui/dom.js',
  './js/ui/fx.js',
  './js/ui/guard.js',
  './js/ui/icon-paths.js',
  './js/ui/icons.js',
  './js/ui/live.js',
  './js/ui/pages.js',
  './js/ui/runner.js',
  './js/ui/sfx.js',
  './js/ui/start.js',
];

const PHOTOS = [
  './assets/people/person-001.webp',
  './assets/people/person-002.webp',
  './assets/people/person-003.webp',
  './assets/people/person-004.webp',
  './assets/people/person-005.webp',
  './assets/people/person-006.webp',
  './assets/people/person-007.webp',
  './assets/people/person-008.webp',
  './assets/people/person-009.webp',
  './assets/people/person-010.webp',
  './assets/people/person-011.webp',
  './assets/people/person-012.webp',
  './assets/people/person-013.webp',
  './assets/people/person-014.webp',
  './assets/people/person-015.webp',
  './assets/people/person-016.webp',
  './assets/people/person-017.webp',
  './assets/people/person-018.webp',
  './assets/people/person-019.webp',
  './assets/people/person-020.webp',
  './assets/people/person-021.webp',
  './assets/people/person-022.webp',
  './assets/people/person-023.webp',
  './assets/people/person-024.webp',
  './assets/people/person-025.webp',
  './assets/people/person-026.webp',
  './assets/people/person-027.webp',
  './assets/people/person-028.webp',
  './assets/people/person-029.webp',
  './assets/people/person-030.webp',
  './assets/people/person-032.webp',
  './assets/people/person-033.webp',
  './assets/people/person-034.webp',
  './assets/people/person-035.webp',
  './assets/people/person-036.webp',
  './assets/people/person-037.webp',
  './assets/people/person-038.webp',
  './assets/people/person-039.webp',
  './assets/people/person-040.webp',
  './assets/people/person-041.webp',
  './assets/people/person-042.webp',
  './assets/people/person-043.webp',
  './assets/people/person-044.webp',
  './assets/people/person-045.webp',
  './assets/people/person-046.webp',
  './assets/people/person-047.webp',
  './assets/people/person-048.webp',
  './assets/people/person-049.webp',
  './assets/people/person-050.webp',
  './assets/people/person-051.webp',
  './assets/people/person-052.webp',
  './assets/people/person-053.webp',
  './assets/people/person-054.webp',
  './assets/people/person-055.webp',
  './assets/people/person-056.webp',
  './assets/people/person-058.webp',
  './assets/people/person-059.webp',
  './assets/people/person-060.webp',
  './assets/people/person-061.webp',
  './assets/people/person-062.webp',
  './assets/people/person-068.webp',
  './assets/people/person-069.webp',
  './assets/people/person-072.webp',
  './assets/people/person-081.webp',
  './assets/people/person-082.webp',
  './assets/people/person-083.webp',
  './assets/people/person-084.webp',
  './assets/people/person-085.webp',
  './assets/people/person-088.webp',
  './assets/people/person-089.webp',
  './assets/people/person-090.webp',
  './assets/people/person-091.webp',
  './assets/people/person-092.webp',
  './assets/people/person-098.webp',
  './assets/people/person-102.webp',
  './assets/people/person-103.webp',
  './assets/people/person-107.webp',
  './assets/people/person-108.webp',
  './assets/people/person-110.webp',
  './assets/people/person-122.webp',
  './assets/people/person-123.webp',
  './assets/people/person-124.webp',
  './assets/people/person-125.webp',
  './assets/people/person-126.webp',
  './assets/people/person-135.webp',
  './assets/people/person-139.webp',
  './assets/people/person-140.webp',
  './assets/people/person-141.webp',
  './assets/people/person-142.webp',
  './assets/people/person-143.webp',
  './assets/people/person-144.webp',
  './assets/people/person-145.webp',
  './assets/people/person-146.webp',
  './assets/people/person-147.webp',
  './assets/people/person-148.webp',
  './assets/people/person-149.webp',
  './assets/people/person-150.webp',
  './assets/people/person-151.webp',
  './assets/people/person-152.webp',
  './assets/people/person-153.webp',
  './assets/people/person-154.webp',
  './assets/people/person-155.webp',
  './assets/people/person-156.webp',
  './assets/people/person-157.webp',
  './assets/people/person-158.webp',
  './assets/people/person-159.webp',
  './assets/people/person-160.webp',
  './assets/people/person-161.webp',
  './assets/people/person-162.webp',
  './assets/people/person-163.webp',
  './assets/people/person-164.webp',
  './assets/people/person-165.webp',
  './assets/people/person-166.webp',
  './assets/people/person-167.webp',
  './assets/people/person-168.webp',
  './assets/people/person-169.webp',
  './assets/people/person-170.webp',
  './assets/people/person-171.webp',
  './assets/people/person-172.webp',
  './assets/people/person-173.webp',
  './assets/people/person-174.webp',
  './assets/people/person-175.webp',
  './assets/people/person-176.webp',
  './assets/people/person-177.webp',
  './assets/people/person-178.webp',
  './assets/people/person-179.webp',
  './assets/people/person-180.webp',
  './assets/people/person-181.webp',
  './assets/people/person-182.webp',
  './assets/people/person-183.webp',
  './assets/people/person-184.webp',
  './assets/people/person-185.webp',
  './assets/people/person-186.webp',
  './assets/people/person-187.webp',
  './assets/people/person-188.webp',
  './assets/people/person-189.webp',
  './assets/people/person-190.webp',
  './assets/people/person-191.webp',
  './assets/people/person-192.webp',
  './assets/people/person-193.webp',
  './assets/people/person-194.webp',
  './assets/people/person-195.webp',
  './assets/people/person-196.webp',
  './assets/people/person-197.webp',
  './assets/people/person-198.webp',
  './assets/people/person-199.webp',
  './assets/people/person-200.webp',
  './assets/people/person-201.webp',
  './assets/people/person-202.webp',
  './assets/people/person-203.webp',
  './assets/people/person-204.webp',
  './assets/people/person-205.webp',
  './assets/people/person-206.webp',
  './assets/people/person-207.webp',
  './assets/people/person-208.webp',
  './assets/people/person-209.webp',
  './assets/people/person-210.webp',
  './assets/people/person-211.webp',
  './assets/people/person-212.webp',
  './assets/people/person-213.webp',
  './assets/people/person-214.webp',
  './assets/people/person-215.webp',
  './assets/people/person-216.webp',
  './assets/people/person-217.webp',
  './assets/people/person-218.webp',
  './assets/people/person-219.webp',
  './assets/people/person-220.webp',
  './assets/people/person-221.webp',
  './assets/people/person-222.webp',
  './assets/people/person-223.webp',
  './assets/people/person-224.webp',
  './assets/people/person-225.webp',
  './assets/people/person-226.webp',
  './assets/people/person-227.webp',
  './assets/people/person-228.webp',
  './assets/people/person-229.webp',
  './assets/people/person-230.webp',
  './assets/people/person-231.webp',
  './assets/people/person-232.webp',
  './assets/people/person-233.webp',
  './assets/people/person-234.webp',
  './assets/people/person-235.webp',
  './assets/people/person-236.webp',
  './assets/people/person-237.webp',
  './assets/people/person-238.webp',
  './assets/people/person-239.webp',
  './assets/people/person-240.webp',
  './assets/people/person-241.webp',
  './assets/people/person-242.webp',
  './assets/people/person-243.webp',
  './assets/people/person-244.webp',
  './assets/people/person-245.webp',
  './assets/people/person-246.webp',
  './assets/people/person-247.webp',
  './assets/people/person-248.webp',
  './assets/people/person-249.webp',
  './assets/people/person-265.webp',
  './assets/people/person-266.webp',
  './assets/people/person-267.webp',
  './assets/people/person-268.webp',
  './assets/people/person-269.webp',
  './assets/people/person-270.webp',
  './assets/people/person-271.webp',
  './assets/people/person-272.webp',
  './assets/people/person-273.webp',
  './assets/people/person-274.webp',
  './assets/people/person-275.webp',
  './assets/people/person-276.webp',
  './assets/people/person-304.webp',
  './assets/people/person-305.webp',
  './assets/people/person-306.webp',
  './assets/people/person-307.webp',
  './assets/people/person-308.webp',
  './assets/people/person-309.webp',
  './assets/people/person-310.webp',
  './assets/people/person-311.webp',
  './assets/people/person-312.webp',
  './assets/people/person-313.webp',
  './assets/people/person-314.webp',
  './assets/people/person-315.webp',
  './assets/people/person-316.webp',
  './assets/people/person-317.webp',
  './assets/people/person-318.webp',
  './assets/people/person-319.webp',
  './assets/people/person-320.webp',
  './assets/people/person-321.webp',
  './assets/people/person-322.webp',
  './assets/people/person-323.webp',
  './assets/people/person-324.webp',
  './assets/people/person-325.webp',
  './assets/people/person-326.webp',
  './assets/people/person-327.webp',
  './assets/people/person-328.webp',
  './assets/people/person-329.webp',
  './assets/people/person-330.webp',
  './assets/people/person-331.webp',
  './assets/people/person-332.webp',
  './assets/people/person-333.webp',
  './assets/people/person-334.webp',
  './assets/people/person-335.webp',
  './assets/people/person-336.webp',
  './assets/people/person-337.webp',
  './assets/people/person-338.webp',
  './assets/people/person-339.webp',
  './assets/people/person-340.webp',
  './assets/people/person-341.webp',
  './assets/people/person-342.webp',
  './assets/people/person-343.webp',
  './assets/people/person-344.webp',
  './assets/people/person-345.webp',
  './assets/people/person-346.webp',
  './assets/people/person-347.webp',
  './assets/people/person-348.webp',
  './assets/people/person-349.webp',
  './assets/people/person-350.webp',
  './assets/people/person-351.webp',
  './assets/people/person-352.webp',
  './assets/people/person-353.webp',
  './assets/people/person-354.webp',
  './assets/people/person-355.webp',
  './assets/people/person-356.webp',
  './assets/people/person-357.webp',
  './assets/people/person-358.webp',
  './assets/people/person-359.webp',
  './assets/people/person-360.webp',
  './assets/people/person-361.webp',
  './assets/people/person-362.webp',
  './assets/people/person-363.webp',
  './assets/people/person-364.webp',
  './assets/people/person-365.webp',
  './assets/people/person-366.webp',
  './assets/people/person-367.webp',
  './assets/people/person-368.webp',
  './assets/people/person-369.webp',
  './assets/people/person-370.webp',
  './assets/people/person-371.webp',
  './assets/people/person-372.webp',
  './assets/people/person-373.webp',
  './assets/people/person-374.webp',
  './assets/people/person-375.webp',
  './assets/people/person-376.webp',
  './assets/people/person-377.webp',
  './assets/people/person-378.webp',
  './assets/people/person-379.webp',
  './assets/people/person-380.webp',
  './assets/people/person-381.webp',
  './assets/people/person-382.webp',
  './assets/people/person-383.webp',
  './assets/people/person-384.webp',
  './assets/people/person-385.webp',
  './assets/people/person-386.webp',
  './assets/people/person-387.webp',
  './assets/people/person-388.webp',
  './assets/people/person-389.webp',
  './assets/people/person-390.webp',
  './assets/people/person-391.webp',
  './assets/people/person-392.webp',
  './assets/people/person-393.webp',
  './assets/people/person-394.webp',
];

const CACHE = 'ttalkkak-bogyul-94559c3a9ed3';
const PHOTO_CACHE = 'ttalkkak-bogyul-photos-95525a0fc9aa';
const PREFIX = 'ttalkkak-bogyul-';
const KEEP = [CACHE, PHOTO_CACHE];

const abs = (u) => new URL(u, self.location).href;
// 브라우저 HTTP 캐시(GitHub Pages 는 10분)를 거치지 않고 서버에서 새로 받는다
const reload = (u) => new Request(abs(u), { cache: 'reload' });

/** 사진 캐시에 아직 없는 사진만 한 장씩 받는다. 실패한 사진은 건너뛴다(다음에 열 때 다시). 받은 장수를 돌려준다.
 *  이미 받는 중이면 같은 작업을 기다린다(설치 중에 화면을 열어도 같은 사진을 두 번 받지 않게). */
let filling = null;
function fillPhotos() {
  if (!filling) filling = fillMissingPhotos().finally(() => { filling = null; });
  return filling;
}

async function fillMissingPhotos() {
  const cache = await caches.open(PHOTO_CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const missing = PHOTOS.filter((u) => !have.has(abs(u)));
  const done = await Promise.allSettled(missing.map((u) => cache.add(reload(u))));
  return done.filter((d) => d.status === 'fulfilled').length;
}

async function install() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS.map(reload));
  await fillPhotos();
}

self.addEventListener('install', (event) => {
  event.waitUntil(install().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && !KEEP.includes(k)).map((k) => caches.delete(k))))
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

const PHOTO_KEYS = new Set(PHOTOS.map(abs));

async function staleWhileRevalidate(event, key) {
  const cache = await caches.open(CACHE);
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

async function cacheFirst(event, key) {
  const cache = await caches.open(PHOTO_CACHE);
  const cached = await cache.match(key);
  if (cached) return cached;
  const res = await fetch(event.request).catch(() => null);
  if (!res) return Response.error();
  if (res.ok && res.type === 'basic') event.waitUntil(cache.put(key, res.clone()));
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // 다른 출처 요청은 건드리지 않는다.
  if (new URL(request.url).origin !== self.location.origin) return;
  const key = cacheKey(request);
  if (PHOTO_KEYS.has(key)) {
    event.respondWith(cacheFirst(event, key));
    return;
  }
  // 화면을 열 때마다 설치 때 받지 못한 사진을 뒤에서 마저 받는다(인터넷이 끊겨 있으면 그냥 실패).
  if (request.mode === 'navigate') event.waitUntil(fillPhotos().catch(() => 0));
  event.respondWith(staleWhileRevalidate(event, key));
});
