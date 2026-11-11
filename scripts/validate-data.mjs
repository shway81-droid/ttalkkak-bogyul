// data/ 자료 검증. 테스트에서 불러 쓰고, CLI 로도 실행한다(실패하면 종료 코드 1).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { poolFor } from '../js/core/plan.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIN_POOL = { word: 30, gesture: 15, quizboard: 20, story: 3, draw: 3 };
const POOL_NAME = { word: '말놀이', gesture: '몸으로 말해요', quizboard: '상식 퀴즈', story: '이야기', draw: '그리기' };
const FLOW_IDS = ['lively', 'calm'];
const PARTICLE_RE = /\{title\}(이|가|을|를|은|는)/;

/** data/ 의 JSON 을 앱이 쓰는 모양({words, stories, drawings, quiz, sets, decorate})으로 읽는다 */
export function readDataDir(dir = join(ROOT, 'data')) {
  const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  return {
    words: read('words.json').items,
    stories: read('stories.json').stories,
    drawings: read('drawings.json').drawings,
    quiz: read('quiz.json').items,
    sets: read('sets.json').sets,
    decorate: read('decorate.json'),
  };
}

/** 오류 문구 목록. 빈 배열이면 통과 */
export function validateData(data) {
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
      ['draw', poolFor('draw', set, data).length],
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

  // 4) 꾸미기 문구
  const themes = new Set(data.drawings.map((d) => d.theme));
  for (const theme of themes) {
    const lines = data.decorate[theme];
    if (!Array.isArray(lines) || lines.length !== 3) {
      errs.push(`꾸미기 문구: ${theme} 주제는 3개여야 합니다`);
      continue;
    }
    for (const line of lines) {
      if (!line.includes('{title}')) errs.push(`꾸미기 문구: ${theme} "${line}" 에 {title} 이 없습니다`);
      if (PARTICLE_RE.test(line)) errs.push(`꾸미기 문구: ${theme} "${line}" 의 {title} 바로 뒤에 조사가 있습니다`);
    }
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
