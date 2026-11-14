// 단일 HTML 파일 만들기: dist/딸깍보결.html
// 파일 하나만 주고받아 더블클릭하면(인터넷 없이도) 수업·선생님용 정답 창·진행 대본·사진 출처가 모두 된다.
// 웹사이트와 같은 코드·자료를 그대로 쓴다 — 웹사이트를 고친 뒤 `npm run single` 을 다시 돌리면 된다.
//
// 담는 것
//   - 자료(data/*.json)        → window.__BOGYUL_DATA__ (js/core/data.js 가 fetch 대신 읽음)
//   - 인물 사진(assets/people)  → 자료 속 photo.file 을 data: 주소로 바꿈
//   - 글꼴(Pretendard 서브셋)    → @font-face 의 data: 주소
//   - 스타일                    → 화면별 <style data-mode="…"> (js/single.js 가 켜고 끔)
//   - 코드                      → esbuild 로 js/single.js 하나로 묶어 <script> 안에
//   - 화면 뼈대                  → index·print·answer·credits.html 의 <body> 를 <template> 로
// 서비스 워커는 넣지 않는다(파일 자체가 이미 오프라인이다).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'dist');
export const OUT_FILE = join(OUT_DIR, '딸깍보결.html');

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');

/** <body> … </body> 사이에서 <script>·<noscript> 를 뺀 뼈대 */
function bodyOf(file) {
  const html = read(file);
  const body = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
  return body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '').trim();
}

const titleOf = (file) => (read(file).match(/<title>([^<]*)<\/title>/) || [])[1] || '딸깍 보결';

// </script> 가 문자열 안에 있어도 스크립트가 끊기지 않게
const safeScript = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

export async function buildSingle() {
  // 자료: js/core/data.js 의 loadData 가 돌려주는 모양 그대로
  const people = readJson('data/people.json').people.map((p) => ({
    ...p,
    photo: { ...p.photo, file: `data:image/webp;base64,${b64(p.photo.file)}` },
  }));
  const data = {
    words: readJson('data/words.json').items,
    stories: readJson('data/stories.json').stories,
    people,
    quiz: readJson('data/quiz.json').items,
    sets: readJson('data/sets.json').sets,
  };

  // 글꼴은 data: 주소로
  const fontUrl = `data:font/woff2;base64,${b64('assets/fonts/PretendardVariable.subset.woff2')}`;
  const fonts = read('css/fonts.css').replace(/url\('\.\.\/assets\/fonts\/PretendardVariable\.subset\.woff2'\)/g, `url('${fontUrl}')`);

  const styles = [
    ['app print answer credits', fonts],
    ['app', read('css/base.css') + read('css/app.css')],
    ['print', read('css/print.css')],
    ['answer', read('css/answer.css')],
    ['credits', read('css/credits.css')],
  ].map(([mode, css]) => `<style data-mode="${mode}">\n${css}\n</style>`).join('\n');

  const templates = [
    ['app', 'index.html'],
    ['print', 'print.html'],
    ['answer', 'answer.html'],
    ['credits', 'credits.html'],
  ].map(([mode, file]) => `<template id="tpl-${mode}" data-title="${titleOf(file)}">\n${bodyOf(file)}\n</template>`).join('\n');

  const bundle = await build({
    entryPoints: [join(ROOT, 'js', 'single.js')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    write: false,
    legalComments: 'none',
  });
  const code = bundle.outputFiles[0].text;

  const favicon = `data:image/svg+xml;base64,${b64('favicon.svg')}`;
  const commit = (() => {
    try {
      return execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  })();

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>딸깍 보결</title>
<meta name="description" content="갑자기 보결 들어간 초등 선생님을 위한 40분 모둠 수업. 학년만 누르면 시작돼요. (파일 하나 버전)">
<meta name="theme-color" content="#f4f6fa">
<meta name="generator" content="scripts/build-single.mjs ${new Date().toISOString().slice(0, 10)}${commit ? ` ${commit}` : ''}">
<link rel="icon" href="${favicon}" type="image/svg+xml">
${styles}
</head>
<body>
${templates}
<noscript>이 파일은 자바스크립트가 켜져 있어야 해요. 크롬이나 엣지로 열어 주세요.</noscript>
<script>window.__BOGYUL_SINGLE__ = true;
window.__BOGYUL_DATA__ = ${safeScript(JSON.stringify(data))};</script>
<script>${safeScript(code)}</script>
</body>
</html>
`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html);
  return { file: OUT_FILE, bytes: statSync(OUT_FILE).size, photos: people.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSingle().then(({ file, bytes, photos }) => {
    console.log(`단일 HTML: ${file} (${(bytes / 1024 / 1024).toFixed(2)}MB, 인물 사진 ${photos}장)`);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
