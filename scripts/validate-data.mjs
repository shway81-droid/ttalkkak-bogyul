// data/ 자료 검증. 테스트에서 불러 쓰고, CLI 로도 실행한다(실패하면 종료 코드 1).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { poolFor } from '../js/core/plan.js';
import { isFreeLicense } from '../js/core/license.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIN_POOL = { word: 30, gesture: 15, quizboard: 20, story: 3, person: 20 };
const POOL_NAME = { word: '말놀이', gesture: '몸으로 말해요', quizboard: '상식 퀴즈', story: '이야기', person: '인물 퀴즈' };
const FLOW_IDS = ['lively', 'calm'];
const PHOTO_FILE_RE = /^assets\/people\/[\w-]+\.webp$/;

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

/** 오류 문구 목록. 빈 배열이면 통과. exists(경로)로 인물 사진 파일이 있는지 본다 */
export function validateData(data, exists = (p) => existsSync(join(ROOT, p))) {
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
    if (photo.license && !isFreeLicense(photo.license)) errs.push(`인물 ${p.id}: 쓸 수 없는 라이선스입니다 (${photo.license})`);
    if (!p.hint || !p.answer) errs.push(`인물 ${p.id}: 힌트나 정답이 없습니다`);
  }

  return errs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errs = validateData(readDataDir());
  if (errs.length) {
    for (const e of errs) console.error(e);
    process.exit(1);
  }
  console.log('자료 검증 통과');
}
