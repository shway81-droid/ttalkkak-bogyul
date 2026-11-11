// 서비스 워커가 미리 담아 두는 파일 목록(ASSETS)이 실제 파일과 맞는지 본다.
// 목록에서 빠진 파일은 인터넷이 끊기면 열리지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('화면에 필요한 파일이 모두 ASSETS 에 있다', () => {
  const assets = new Set(readAssets());
  const need = ['./index.html', './print.html', './manifest.json', './favicon.svg'];
  for (const dir of ['js', 'css', 'data', 'assets']) need.push(...walk(join(ROOT, dir)));
  const missing = need.filter((f) => !assets.has(f));
  assert.deepEqual(missing, []);
});
