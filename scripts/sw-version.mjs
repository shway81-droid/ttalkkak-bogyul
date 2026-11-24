// 서비스 워커 찍기: 화면에 필요한 파일 목록(listAssets)으로 sw.js 의 ASSETS(화면 파일)·PHOTOS(인물 사진)를 새로 쓰고,
// 각 목록의 파일 내용으로 해시를 만들어 `const CACHE = 'ttalkkak-bogyul-<해시>';`,
// `const PHOTO_CACHE = 'ttalkkak-bogyul-photos-<해시>';` 를 고쳐 쓴다.
// 화면 파일이 하나라도 바뀌면 sw.js 가 바뀌므로, 배포 뒤 브라우저가 서비스 워커를 새로 설치하고
// 화면 파일을 한꺼번에 새로 받는다(옛 파일과 새 파일이 섞이지 않게). 사진이 그대로면 사진 캐시 이름도 그대로라
// 사진은 다시 받지 않는다.
// tests/sw.test.mjs 가 이름이 맞는지 본다. 파일을 바꿨다면: npm run stamp
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep, posix } from 'node:path';
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

/** sw.js 글에서 name(ASSETS·PHOTOS) 배열의 경로들 */
export function readList(swSource, name) {
  const m = swSource.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`sw.js 에 const ${name} = [ ... ]; 가 없습니다`);
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

/** sw.js 글에서 ASSETS 배열의 경로들 */
export const readAssets = (swSource) => readList(swSource, 'ASSETS');

/** sw.js 글에서 name(CACHE·PHOTO_CACHE) 문자열 */
export function readConst(swSource, name) {
  const m = swSource.match(new RegExp(`const\\s+${name}\\s*=\\s*'([^']+)'`));
  if (!m) throw new Error(`sw.js 에 const ${name} = '...'; 가 없습니다`);
  return m[1];
}

/** 인물 사진(따로 캐시) */
export const isPhoto = (a) => a.startsWith('./assets/people/');

/** 파일 목록을 화면 파일(assets)과 인물 사진(photos)으로 나누고 각 캐시 이름을 붙인다 */
export function stampFor(root, all) {
  const assets = all.filter((a) => !isPhoto(a));
  const photos = all.filter(isPhoto);
  return {
    assets,
    photos,
    cache: `ttalkkak-bogyul-${assetsHash(root, assets)}`,
    photoCache: `ttalkkak-bogyul-photos-${assetsHash(root, photos)}`,
  };
}

const ROOT_FILES = ['./manifest.json', './favicon.svg'];
const DIRS = ['assets', 'css', 'data', 'js'];

function walk(root, dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    // .DS_Store 같은 숨은 파일은 저장소에 없으니 넣지 않는다(넣으면 배포된 사이트에서 404 → 오프라인 사본 실패)
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(root, p));
    else out.push(`./${relative(root, p).split(sep).join('/')}`);
  }
  return out;
}

/** 화면에 필요한 파일: 맨 위의 html(index.html 먼저)·manifest·favicon 과 assets·css·data·js 아래 모든 파일 */
export function listAssets(root) {
  const html = readdirSync(root)
    .filter((n) => n.endsWith('.html'))
    .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  return [...html.map((n) => `./${n}`), ...ROOT_FILES, ...DIRS.flatMap((d) => walk(root, join(root, d)))];
}

// ---- 모듈 미리 받기(index.html 의 <link rel="modulepreload">) ----------------------------------
// 첫 화면은 js/main.js 가 import 로 닿는 모듈을 모두 읽어야 뜬다. 그대로 두면 브라우저는 모듈을 읽어 봐야
// 다음 import 를 알게 되어 5단 계단(왕복 5번)으로 받는다. 목록을 미리 적어 두면 한 번에 받는다.
export const PRELOAD_START = '<!-- 모듈 미리 받기: npm run stamp 가 js/main.js 에서 닿는 모듈로 새로 씀 -->';
export const PRELOAD_END = '<!-- /모듈 미리 받기 -->';

/** entry 에서 정적 import·export … from 으로 닿는 모듈(entry 빼고), 처음 만난 순서 */
export function moduleGraph(root, entry = 'js/main.js') {
  const seen = [];
  const visit = (rel) => {
    if (seen.includes(rel)) return;
    seen.push(rel);
    const src = readFileSync(join(root, rel), 'utf8');
    const deps = src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm);
    for (const m of deps) visit(posix.join(posix.dirname(rel), m[1] ?? m[2]));
  };
  visit(entry);
  return seen.slice(1);
}

/** index.html 글의 미리 받기 칸을 modules 로 바꾼 글 */
export function withPreloads(html, modules) {
  const a = html.indexOf(PRELOAD_START);
  const b = html.indexOf(PRELOAD_END);
  if (a < 0 || b < a) throw new Error(`index.html 에 ${PRELOAD_START} … ${PRELOAD_END} 칸이 없습니다`);
  const indent = html.slice(html.lastIndexOf('\n', a) + 1, a);
  const links = modules.map((m) => `${indent}<link rel="modulepreload" href="${m}">\n`).join('');
  return `${html.slice(0, a)}${PRELOAD_START}\n${links}${indent}${html.slice(b)}`;
}

/** index.html 글에 적힌 modulepreload 주소들 */
export const readPreloads = (html) => [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  // index.html 이 바뀌면 캐시 이름도 바뀌므로 미리 받기 목록을 먼저 쓴다
  const indexFile = join(root, 'index.html');
  const indexSrc = readFileSync(indexFile, 'utf8');
  const modules = moduleGraph(root);
  const indexNext = withPreloads(indexSrc, modules);
  if (indexNext !== indexSrc) {
    writeFileSync(indexFile, indexNext);
    console.log(`index.html 모듈 미리 받기 ${modules.length}개 새로 씀`);
  }
  const file = join(root, 'sw.js');
  const src = readFileSync(file, 'utf8');
  const { assets, photos, cache, photoCache } = stampFor(root, listAssets(root));
  const list = (name, xs) => `const ${name} = [\n${xs.map((a) => `  '${a}',\n`).join('')}];`;
  const next = src
    .replace(/const\s+ASSETS\s*=\s*\[[\s\S]*?\];/, list('ASSETS', assets))
    .replace(/const\s+PHOTOS\s*=\s*\[[\s\S]*?\];/, list('PHOTOS', photos))
    .replace(/const\s+CACHE\s*=\s*'[^']*';/, `const CACHE = '${cache}';`)
    .replace(/const\s+PHOTO_CACHE\s*=\s*'[^']*';/, `const PHOTO_CACHE = '${photoCache}';`);
  const what = `화면 파일 ${assets.length}개(${cache}), 사진 ${photos.length}장(${photoCache})`;
  if (next === src) {
    console.log(`그대로: ${what}`);
    return;
  }
  writeFileSync(file, next);
  console.log(`새로 찍음: ${what}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
