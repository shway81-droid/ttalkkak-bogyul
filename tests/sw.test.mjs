// 서비스 워커가 미리 담아 두는 파일 목록(ASSETS)이 실제 파일과 맞는지 본다.
// 목록에서 빠진 파일은 인터넷이 끊기면 열리지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assetsHash, listAssets } from '../scripts/sw-version.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function readAssets() {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const m = src.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(m, 'sw.js 에 const ASSETS = [ ... ]; 가 있어야 합니다');
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(`./${relative(ROOT, p).split(sep).join('/')}`);
  }
  return out;
}

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
test('CACHE 이름이 ASSETS 파일 내용의 해시와 맞다(파일을 바꿨다면 npm run stamp)', () => {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const m = src.match(/const\s+CACHE\s*=\s*'([^']+)'/);
  assert.ok(m, "sw.js 에 const CACHE = '...'; 가 있어야 합니다");
  assert.equal(m[1], `ttalkkak-bogyul-${assetsHash(ROOT, readAssets())}`, '파일이 바뀌었습니다 — npm run stamp 로 캐시 이름을 새로 찍어 주세요');
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

test('설치할 때 브라우저 HTTP 캐시를 거치지 않고 ASSETS 전부를 새로 받는다', async () => {
  const handlers = {};
  let added = null;
  const swUrl = new URL('https://example.test/ttalkkak-bogyul/sw.js');
  const sandbox = {
    self: { addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting: async () => {}, location: swUrl, clients: { claim: async () => {} } },
    caches: { open: async () => ({ addAll: async (reqs) => { added = reqs; } }) },
    Request,
    URL,
  };
  vm.runInNewContext(readFileSync(join(ROOT, 'sw.js'), 'utf8'), sandbox);
  let waiting = null;
  handlers.install({ waitUntil: (p) => { waiting = p; } });
  await waiting;
  const assets = readAssets();
  assert.equal(added.length, assets.length);
  added.forEach((req, i) => {
    assert.equal(req.cache, 'reload', `${assets[i]} 는 cache: 'reload' 로 받아야 합니다`);
    assert.equal(req.url, new URL(assets[i], swUrl).href);
  });
});

test('화면에 필요한 파일이 모두 ASSETS 에 있다', () => {
  const assets = new Set(readAssets());
  const need = ['./index.html', './print.html', './credits.html', './manifest.json', './favicon.svg'];
  for (const dir of ['js', 'css', 'data', 'assets']) need.push(...walk(join(ROOT, dir)));
  const missing = need.filter((f) => !assets.has(f));
  assert.deepEqual(missing, []);
});

test('ASSETS 는 npm run stamp 가 실제 파일로 만든 목록과 같다(사진을 다시 가져오면 npm run stamp)', () => {
  assert.deepEqual(readAssets(), listAssets(ROOT));
});
