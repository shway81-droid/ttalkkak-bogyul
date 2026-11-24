// 서비스 워커가 미리 담아 두는 파일 목록(ASSETS)이 실제 파일과 맞는지 본다.
// 목록에서 빠진 파일은 인터넷이 끊기면 열리지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assetsHash, listAssets, readList, readConst, stampFor, moduleGraph, withPreloads, readPreloads, PRELOAD_START, PRELOAD_END } from '../scripts/sw-version.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const swSource = () => readFileSync(join(ROOT, 'sw.js'), 'utf8');
/** 화면 파일과 인물 사진을 합친 목록(서비스 워커가 담아 두는 모든 파일) */
const readAssets = () => [...readList(swSource(), 'ASSETS'), ...readList(swSource(), 'PHOTOS')];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue; // .DS_Store 같은 숨은 파일은 저장소에 없다
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(`./${relative(ROOT, p).split(sep).join('/')}`);
  }
  return out;
}

// 첫 화면에 필요한 모듈을 계단식(왕복 5번)이 아니라 한 번에 받게: 목록이 모자라면 느려지고, 남으면 헛받는다.
test('index.html 의 모듈 미리 받기 목록이 js/main.js 에서 닿는 모듈과 같다(모듈을 더하거나 뺐다면 npm run stamp)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const graph = moduleGraph(ROOT);
  assert.ok(graph.includes('js/ui/start.js') && graph.includes('js/core/wordTypes.js'), graph.join(', '));
  assert.deepEqual(readPreloads(html), graph, 'npm run stamp 로 index.html 의 모듈 미리 받기 목록을 새로 써 주세요');
  for (const m of graph) assert.ok(existsSync(join(ROOT, m)), `${m} 파일이 없습니다`);
});

test('moduleGraph 는 여러 줄 import·export … from·부수 효과 import 를 따라가고, 동적 import 는 뺀다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-graph-'));
  mkdirSync(join(dir, 'js', 'ui'), { recursive: true });
  writeFileSync(join(dir, 'js', 'main.js'), "import {\n  a,\n  b,\n} from './ui/a.js';\nimport './side.js';\n// import x from './nope.js';\nconst later = () => import('./lazy.js');\n");
  writeFileSync(join(dir, 'js', 'ui', 'a.js'), "export * from '../re.js';\nexport const a = 1, b = 2;\n");
  writeFileSync(join(dir, 'js', 'side.js'), "import { a } from './ui/a.js';\n");
  writeFileSync(join(dir, 'js', 're.js'), 'export const r = 1;\n');
  assert.deepEqual(moduleGraph(dir), ['js/ui/a.js', 'js/re.js', 'js/side.js']);
  const html = `<head>\n  ${PRELOAD_START}\n  <link rel="modulepreload" href="old.js">\n  ${PRELOAD_END}\n</head>`;
  const next = withPreloads(html, ['js/a.js', 'js/b.js']);
  assert.deepEqual(readPreloads(next), ['js/a.js', 'js/b.js']);
  assert.equal(withPreloads(next, ['js/a.js', 'js/b.js']), next);
});

test('ASSETS 는 모두 ./ 로 시작하고 실제 파일이 있다', () => {
  const assets = readAssets();
  assert.ok(assets.length > 0);
  for (const a of assets) {
    assert.ok(a.startsWith('./'), `${a} 는 ./ 로 시작해야 합니다`);
    assert.ok(existsSync(join(ROOT, a)), `${a} 파일이 없습니다`);
  }
});

test('ASSETS 에 겹치는 항목이 없다', () => {
  const assets = readAssets();
  assert.equal(new Set(assets).size, assets.length);
});

// 배포 뒤 옛 파일과 새 파일이 섞이지 않게: 파일 내용이 바뀌면 캐시 이름이 바뀌어 sw.js 가 새로 설치된다.
test('CACHE·PHOTO_CACHE 이름이 각 목록 파일 내용의 해시와 맞다(파일을 바꿨다면 npm run stamp)', () => {
  const src = swSource();
  const msg = '파일이 바뀌었습니다 — npm run stamp 로 캐시 이름을 새로 찍어 주세요';
  assert.equal(readConst(src, 'CACHE'), `ttalkkak-bogyul-${assetsHash(ROOT, readList(src, 'ASSETS'))}`, msg);
  assert.equal(readConst(src, 'PHOTO_CACHE'), `ttalkkak-bogyul-photos-${assetsHash(ROOT, readList(src, 'PHOTOS'))}`, msg);
});

// 화면 파일 하나만 바뀐 배포에서 이미 열어 본 PC가 사진까지 다시 받지 않게
test('인물 사진은 PHOTOS 에만 있고, 화면 파일이 바뀌어도 사진 캐시 이름은 그대로다', () => {
  const src = swSource();
  const assets = readList(src, 'ASSETS');
  const photos = readList(src, 'PHOTOS');
  assert.equal(assets.filter((a) => a.startsWith('./assets/people/')).length, 0);
  assert.ok(photos.length > 0 && photos.every((a) => /^\.\/assets\/people\/[\w-]+\.webp$/.test(a)));

  const dir = mkdtempSync(join(tmpdir(), 'sw-split-'));
  mkdirSync(join(dir, 'assets', 'people'), { recursive: true });
  writeFileSync(join(dir, 'app.js'), 'one');
  writeFileSync(join(dir, 'assets', 'people', 'p-1.webp'), 'photo');
  const all = ['./app.js', './assets/people/p-1.webp'];
  const a = stampFor(dir, all);
  writeFileSync(join(dir, 'app.js'), 'two');
  const b = stampFor(dir, all);
  assert.notEqual(a.cache, b.cache);
  assert.equal(a.photoCache, b.photoCache);
  writeFileSync(join(dir, 'assets', 'people', 'p-1.webp'), 'photo2');
  assert.notEqual(stampFor(dir, all).photoCache, b.photoCache);
});

test('assetsHash 는 내용이 바뀌면 달라지고, 줄바꿈(CRLF/LF)에는 흔들리지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-hash-'));
  writeFileSync(join(dir, 'a.js'), 'one\ntwo\n');
  const h1 = assetsHash(dir, ['./a.js']);
  writeFileSync(join(dir, 'a.js'), 'one\r\ntwo\r\n');
  assert.equal(assetsHash(dir, ['./a.js']), h1);
  writeFileSync(join(dir, 'a.js'), 'one\ntwo!\n');
  assert.notEqual(assetsHash(dir, ['./a.js']), h1);
});

/** sw.js 를 가짜 브라우저(캐시는 Map)에서 돌린다. failPhoto(url) 가 참이면 그 사진 받기는 실패.
 *  network(request) 를 주면 fetch 가 그 값을 돌려준다(없으면 인터넷이 끊긴 것처럼 실패). */
function loadSw({ failPhoto = () => false, stored = {}, network = null } = {}) {
  const handlers = {};
  const swUrl = new URL('https://example.test/ttalkkak-bogyul/sw.js');
  const store = new Map(Object.entries(stored).map(([k, v]) => [k, new Map(v.map((u) => [u, 'old']))]));
  const calls = { addAll: [], add: [], put: [], fetch: [] };
  const openCache = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return {
      addAll: async (reqs) => { calls.addAll.push({ name, reqs }); for (const r of reqs) m.set(r.url, 'new'); },
      add: async (req) => {
        calls.add.push({ name, req });
        if (failPhoto(req.url)) throw new Error('network');
        m.set(req.url, 'new');
      },
      keys: async () => [...m.keys()].map((url) => ({ url })),
      match: async (key) => m.get(key),
      put: async (key, v) => { calls.put.push({ name, key }); m.set(key, v); },
    };
  };
  const sandbox = {
    self: { addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting: async () => {}, location: swUrl, clients: { claim: async () => {} } },
    caches: {
      open: async (name) => openCache(name),
      keys: async () => [...store.keys()],
      delete: async (name) => store.delete(name),
    },
    Request,
    URL,
    fetch: async (req) => {
      calls.fetch.push(req.url);
      if (!network) throw new Error('offline');
      return network(req);
    },
    Response: { error: () => 'error' },
  };
  vm.runInNewContext(swSource(), sandbox);
  const run = async (type, extra = {}) => {
    let waiting = null;
    handlers[type]({ waitUntil: (p) => { waiting = p; }, ...extra });
    await waiting;
  };
  return { run, store, calls, swUrl };
}

test('설치할 때 브라우저 HTTP 캐시를 거치지 않고 화면 파일은 한꺼번에, 사진은 한 장씩 받는다', async () => {
  const { run, calls, swUrl } = loadSw();
  await run('install');
  const src = swSource();
  const assets = readList(src, 'ASSETS');
  const photos = readList(src, 'PHOTOS');
  assert.equal(calls.addAll.length, 1);
  assert.equal(calls.addAll[0].name, readConst(src, 'CACHE'));
  assert.deepEqual([...calls.addAll[0].reqs].map((r) => r.url), assets.map((a) => new URL(a, swUrl).href));
  assert.ok(calls.addAll[0].reqs.every((r) => r.cache === 'reload'));
  assert.equal(calls.add.length, photos.length);
  assert.ok(calls.add.every(({ name, req }) => name === readConst(src, 'PHOTO_CACHE') && req.cache === 'reload'));
});

test('사진 몇 장을 못 받아도 설치는 되고, 다음에 화면을 열면 빠진 사진만 다시 받는다', async () => {
  let offline = true;
  const sw = loadSw({ failPhoto: (u) => offline && /person-00[1-3]\.webp$/.test(u) });
  await sw.run('install');
  const photoCache = readConst(swSource(), 'PHOTO_CACHE');
  const photos = readList(swSource(), 'PHOTOS');
  assert.equal(sw.store.get(photoCache).size, photos.length - 3);
  offline = false;
  sw.calls.add.length = 0;
  await sw.run('fetch', { request: { method: 'GET', mode: 'navigate', url: new URL('./', sw.swUrl).href }, respondWith: () => {} });
  assert.equal(sw.calls.add.length, 3);
  assert.equal(sw.store.get(photoCache).size, photos.length);
});

test('이미 같은 사진 캐시가 있으면(화면 파일만 바뀐 배포) 사진은 다시 받지 않고, 옛 화면 캐시만 지운다', async () => {
  const src = swSource();
  const photoCache = readConst(src, 'PHOTO_CACHE');
  const swUrl = 'https://example.test/ttalkkak-bogyul/';
  const photos = readList(src, 'PHOTOS').map((a) => new URL(a, swUrl).href);
  const sw = loadSw({ stored: { [photoCache]: photos, 'ttalkkak-bogyul-oldoldoldold': ['x'], 'ttalkkak-bogyul-photos-oldoldoldold': ['y'], 'other-app': ['z'] } });
  await sw.run('install');
  assert.equal(sw.calls.add.length, 0);
  await sw.run('activate');
  assert.deepEqual([...sw.store.keys()].sort(), [readConst(src, 'CACHE'), photoCache, 'other-app'].sort());
});

// 화면 파일은 캐시 이름(내용 해시)이 판을 가른다. 파일이 바뀌면 sw.js 가 바뀌어 새로 설치되고 새 캐시에 한꺼번에 받는다.
// 그래서 담아 둔 파일은 그것으로만 답한다. 뒤에서 다시 받아 같은 칸을 덮어쓰면, 다른 페이지가 그 칸을 읽는 도중
// 요청이 끊겨(net::ERR_ABORTED) 모듈 하나가 빠지고 첫 화면이 빈 채로 남는다(브라우저 검사가 가끔 멈추던 원인).
test('화면 파일이 캐시에 있으면 캐시로만 답하고, 뒤에서 다시 받아 덮어쓰지 않는다', async () => {
  const fresh = { ok: true, type: 'basic', clone() { return this; } };
  const probe = loadSw({ network: () => fresh });
  const url = new URL('./js/main.js', probe.swUrl).href;
  const sw = loadSw({ stored: { [readConst(swSource(), 'CACHE')]: [url] }, network: () => fresh });
  let answer = null;
  await sw.run('fetch', { request: { method: 'GET', mode: 'cors', url }, respondWith: (p) => { answer = p; } });
  assert.equal(await answer, 'old');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(sw.calls.fetch, [], '담아 둔 파일을 인터넷에서 다시 받지 않는다');
  assert.deepEqual(sw.calls.put, [], '담아 둔 칸을 덮어쓰지 않는다');
});

test('캐시에 없는 파일은 인터넷에서 받아 답하고 담아 둔다', async () => {
  const fresh = { ok: true, type: 'basic', clone() { return this; } };
  const sw = loadSw({ network: () => fresh });
  const url = new URL('./js/main.js', sw.swUrl).href;
  let answer = null;
  await sw.run('fetch', { request: { method: 'GET', mode: 'cors', url }, respondWith: (p) => { answer = p; } });
  assert.equal(await answer, fresh);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(sw.calls.fetch, [url]);
  assert.deepEqual(sw.calls.put.map((p) => p.key), [url]);
});

test('화면에 필요한 파일이 모두 ASSETS 에 있다', () => {
  const assets = new Set(readAssets());
  const need = ['./index.html', './print.html', './credits.html', './manifest.json', './favicon.svg'];
  for (const dir of ['js', 'css', 'data', 'assets']) need.push(...walk(join(ROOT, dir)));
  const missing = need.filter((f) => !assets.has(f));
  assert.deepEqual(missing, []);
});

test('ASSETS·PHOTOS 는 npm run stamp 가 실제 파일로 만든 목록과 같다(사진을 다시 가져오면 npm run stamp)', () => {
  const { assets, photos } = stampFor(ROOT, listAssets(ROOT));
  assert.deepEqual(readList(swSource(), 'ASSETS'), assets);
  assert.deepEqual(readList(swSource(), 'PHOTOS'), photos);
});
