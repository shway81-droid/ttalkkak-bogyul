// data/ 자료 검증. 테스트에서 불러 쓰고, CLI 로도 실행한다(실패하면 종료 코드 1).
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { poolFor } from '../js/core/plan.js';
import { isFreeLicense } from '../js/core/license.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIN_POOL = { word: 30, gesture: 15, quizboard: 20, story: 3, person: 20 };
const POOL_NAME = { word: '말놀이', gesture: '몸으로 말해요', quizboard: '상식 퀴즈', story: '이야기', person: '인물 퀴즈' };
const FLOW_IDS = ['lively', 'calm'];
const PHOTO_FILE_RE = /^assets\/people\/[\w-]+\.webp$/;
/** 사진 원본 주소로 받는 곳. 지금은 위키미디어 공용만 — 다른 곳의 사진을 쓰게 되면 라이선스를 확인하고 여기에 더한다 */
export const PHOTO_SOURCE_HOSTS = ['commons.wikimedia.org'];

const blank = (v) => !String(v ?? '').trim();
const photoHash = (p) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');

/** 같은 값이 두 번 이상 나오면 [값, 처음 id, 다음 id] 목록 */
function duplicates(items, keyFn) {
  const seen = new Map();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (k === undefined || k === null || k === '') continue;
    if (seen.has(k)) out.push([k, seen.get(k), it.id]);
    else seen.set(k, it.id);
  }
  return out;
}

/** data/ 의 JSON 을 앱이 쓰는 모양({words, stories, people, quiz, sets})으로 읽는다(js/core/data.js 와 같은 모양) */
export function readDataDir(dir = join(ROOT, 'data')) {
  const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  return {
    words: read('words.json').items,
    stories: read('stories.json').stories,
    people: read('people.json').people,
    quiz: read('quiz.json').items,
    sets: read('sets.json').sets,
  };
}

/**
 * 오류 문구 목록. 빈 배열이면 통과. exists(경로)로 인물 사진 파일이 있는지 보고,
 * hashOf(경로)로 같은 사진이 두 인물에 쓰였는지 본다(null 이면 내용 비교를 건너뜀).
 */
export function validateData(data, exists = (p) => existsSync(join(ROOT, p)), hashOf = photoHash) {
  const errs = [];

  // 1) 학년 1~6 × 흐름 2 = 12세트, 하나씩
  for (let g = 1; g <= 6; g++) {
    for (const f of FLOW_IDS) {
      const id = `g${g}-${f}`;
      const found = data.sets.filter((s) => s.grade === g && s.flow === f);
      if (found.length === 0) errs.push(`세트 ${id} 이(가) 없습니다`);
      if (found.length > 1) errs.push(`세트 ${id} 이(가) ${found.length}개 있습니다`);
    }
  }
  if (data.sets.length !== 12) errs.push(`세트는 12개여야 하는데 ${data.sets.length}개입니다`);

  // 2) 풀 크기
  for (const set of data.sets) {
    const checks = [
      ['word', poolFor('word', set, data).length],
      [set.team.kind, poolFor('team', set, data).length],
      ['story', poolFor('story', set, data).length],
      ['person', poolFor('person', set, data).length],
    ];
    for (const [kind, n] of checks) {
      const min = MIN_POOL[kind];
      if (min === undefined) errs.push(`${set.id}: 모르는 모둠 놀이 종류 ${kind}`);
      else if (n < min) errs.push(`${set.id}: ${POOL_NAME[kind]} 후보가 ${n}개로 ${min}개보다 적습니다`);
    }
  }

  // 3) 같은 학년 두 세트는 서로 달라야 한다
  for (let g = 1; g <= 6; g++) {
    const pair = data.sets.filter((s) => s.grade === g);
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    const overlap = a.word.types.filter((t) => b.word.types.includes(t));
    if (overlap.length) errs.push(`${g}학년 두 세트의 말놀이 유형이 겹칩니다: ${overlap.join(', ')}`);
    if (a.team.kind === b.team.kind) errs.push(`${g}학년 두 세트의 모둠 놀이 종류가 같습니다: ${a.team.kind}`);
  }

  // 4) 인물 사진: 파일이 있고, 출처 페이지에 적을 저작자·라이선스·원본 주소가 있어야 한다
  for (const p of data.people) {
    const photo = p.photo || {};
    if (!PHOTO_FILE_RE.test(photo.file || '') || !exists(photo.file)) errs.push(`인물 ${p.id}: 사진 파일이 없습니다 (${photo.file})`);
    for (const key of ['author', 'license', 'source']) {
      if (!String(photo[key] || '').trim()) errs.push(`인물 ${p.id}: 사진 ${key} 가 비어 있습니다`);
    }
    // 잘린 이름("…")은 저작자를 다 밝히지 못한다 — scripts/import-jjam.mjs 의 AUTHOR_FULL 에 전체 이름을 더한다
    if (/(…|\.\.\.)\s*$/.test(photo.author || '')) errs.push(`인물 ${p.id}: 사진 저작자 이름이 잘려 있습니다 (${photo.author})`);
    if (photo.license && !isFreeLicense(photo.license)) errs.push(`인물 ${p.id}: 쓸 수 없는 라이선스입니다 (${photo.license})`);
    if (!p.hint || !p.answer) errs.push(`인물 ${p.id}: 힌트나 정답이 없습니다`);
    if (photo.source && !isAllowedSource(photo.source)) errs.push(`인물 ${p.id}: 사진 원본 주소가 ${PHOTO_SOURCE_HOSTS.join('·')} 가 아닙니다 (${photo.source})`);
  }

  // 5) 같은 사진·같은 인물이 두 번 들어가지 않게(가져오기에서 겹치면 한 인물이 두 번 나온다)
  for (const [k, a, b] of duplicates(data.people, (p) => p.photo?.file)) errs.push(`인물 ${a}·${b}: 같은 사진 파일입니다 (${k})`);
  for (const [k, a, b] of duplicates(data.people, (p) => p.photo?.source)) errs.push(`인물 ${a}·${b}: 같은 원본 사진입니다 (${k})`);
  for (const [k, a, b] of duplicates(data.people, (p) => p.answer)) errs.push(`인물 ${a}·${b}: 같은 인물입니다 (${k})`);
  if (hashOf) {
    const withFile = data.people.filter((p) => PHOTO_FILE_RE.test(p.photo?.file || '') && exists(p.photo.file));
    for (const [, a, b] of duplicates(withFile, (p) => hashOf(p.photo.file))) errs.push(`인물 ${a}·${b}: 사진 내용이 똑같습니다`);
  }

  // 6) 문항 자체: 빈 정답·빈 문제, 상식 퀴즈 보기 중복(정답과 같은 보기가 있으면 두 번호가 다 정답)
  for (const [k, a, b] of duplicates([...data.words, ...data.quiz, ...data.people, ...data.stories], (x) => x.id)) errs.push(`문항 id ${k} 가 겹칩니다 (${a}, ${b})`);
  for (const w of data.words) {
    if (w.type === 'gesture') {
      if (blank(w.word)) errs.push(`몸으로 말해요 ${w.id}: 낱말이 비어 있습니다`);
    } else if (blank(w.prompt) || blank(w.answer)) errs.push(`말놀이 ${w.id}: 문제나 정답이 비어 있습니다`);
  }
  for (const q of data.quiz) {
    if (blank(q.q) || blank(q.a)) errs.push(`상식 퀴즈 ${q.id}: 문제나 정답이 비어 있습니다`);
    if (!Array.isArray(q.o) || q.o.length !== 3 || q.o.some(blank)) errs.push(`상식 퀴즈 ${q.id}: 오답 보기는 빈칸 없이 3개여야 합니다`);
    else if (new Set([q.a, ...q.o].map((x) => String(x).trim())).size !== 4) errs.push(`상식 퀴즈 ${q.id}: 보기가 겹칩니다 (${[q.a, ...q.o].join(' / ')})`);
  }
  for (const st of data.stories) {
    if (blank(st.title) || blank(st.mainQuestion) || !st.story?.length || st.story.some(blank)) errs.push(`이야기 ${st.id}: 제목·본문·질문이 비어 있습니다`);
  }

  return errs;
}

function isAllowedSource(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PHOTO_SOURCE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errs = validateData(readDataDir());
  if (errs.length) {
    for (const e of errs) console.error(e);
    process.exit(1);
  }
  console.log('자료 검증 통과');
}
