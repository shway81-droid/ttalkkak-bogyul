// 서비스 워커 캐시 이름 찍기: sw.js 의 ASSETS 파일 내용으로 해시를 만들어
// `const CACHE = 'ttalkkak-bogyul-<해시>';` 를 고쳐 쓴다.
// 화면 파일이 하나라도 바뀌면 sw.js 가 바뀌므로, 배포 뒤 브라우저가 서비스 워커를 새로 설치하고
// 모든 파일을 한꺼번에 새로 받는다(옛 파일과 새 파일이 섞이지 않게).
// tests/sw.test.mjs 가 이름이 맞는지 본다. 파일을 바꿨다면: npm run stamp
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BINARY = /\.(woff2?|png|jpe?g|gif|ico|webp)$/i;

/** ASSETS 파일들의 경로와 내용으로 만든 짧은 해시(글자 파일은 CRLF→LF 로 맞춘 뒤) */
export function assetsHash(root, assets) {
  const hash = createHash('sha256');
  for (const a of assets) {
    const buf = readFileSync(join(root, a));
    hash.update(a);
    hash.update('\0');
    hash.update(BINARY.test(a) ? buf : Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8'));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/** sw.js 글에서 ASSETS 배열의 경로들 */
export function readAssets(swSource) {
  const m = swSource.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (!m) throw new Error('sw.js 에 const ASSETS = [ ... ]; 가 없습니다');
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const file = join(root, 'sw.js');
  const src = readFileSync(file, 'utf8');
  const name = `ttalkkak-bogyul-${assetsHash(root, readAssets(src))}`;
  const next = src.replace(/const\s+CACHE\s*=\s*'[^']*';/, `const CACHE = '${name}';`);
  if (next === src) {
    console.log(`캐시 이름 그대로: ${name}`);
    return;
  }
  writeFileSync(file, next);
  console.log(`캐시 이름 새로 찍음: ${name}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
