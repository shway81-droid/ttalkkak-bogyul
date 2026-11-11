// 세트 하나로 40분 계획(순서 6개)을 만든다.
import { FLOWS, bandOf, BAND_DRAW_LEVEL } from './flows.js';
import { makeRng, makeDeck } from './rng.js';
import { fitsSlot } from './drawing.js';

const TITLES = {
  greet: '인사',
  word: '말놀이',
  gesture: '몸으로 말해요',
  quizboard: '상식 퀴즈',
  story: '이야기',
  draw: '그리기',
  celebrate: '축하',
};

/** 슬롯의 후보 자료 */
export function poolFor(slot, set, data) {
  const band = bandOf(set.grade);
  switch (slot) {
    case 'word':
      return data.words.filter((w) => set.word.types.includes(w.type) && set.word.levels.includes(w.level));
    case 'team':
      if (set.team.kind === 'gesture') {
        return data.words.filter((w) => w.type === 'gesture' && set.team.levels.includes(w.level));
      }
      return data.quiz.filter((q) => q.bands.includes(band));
    case 'story':
      return data.stories.filter((s) => s.grades.includes(band));
    case 'draw':
      return data.drawings.filter((d) => d.difficulty === BAND_DRAW_LEVEL[band] && fitsSlot(d));
    default:
      return [];
  }
}

const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];
// 덱마다 따로 씨앗을 주어, 덱을 뽑는 순서와 상관없이 같은 씨앗이면 같은 결과가 나오게 한다.
const subRng = (rng) => makeRng(Math.floor(rng() * 4294967296));

export function decorateFor(drawing, decorate, rng) {
  const lines = decorate[drawing.theme] || [];
  if (lines.length === 0) return '';
  return pickOne(lines, rng).replaceAll('{title}', drawing.title);
}

/** 세트 → 계획 */
export function buildPlan(set, data, rng) {
  const flow = FLOWS[set.flow];
  const band = bandOf(set.grade);
  const steps = flow.slots.map(([slot, minutes]) => {
    let kind = slot;
    let content = {};
    if (slot === 'word') {
      content = { deck: makeDeck(poolFor('word', set, data), subRng(rng)) };
    } else if (slot === 'team') {
      kind = set.team.kind;
      content = { deck: makeDeck(poolFor('team', set, data), subRng(rng)) };
    } else if (slot === 'story') {
      content = { story: pickOne(poolFor('story', set, data), rng) };
    } else if (slot === 'draw') {
      const drawing = pickOne(poolFor('draw', set, data), rng);
      content = { drawing, decorate: decorateFor(drawing, data.decorate, rng) };
    }
    return { slot, kind, title: TITLES[kind], minutes, content };
  });
  return {
    setId: set.id,
    grade: set.grade,
    band,
    flow: set.flow,
    title: `${set.grade}학년 · ${flow.label}`,
    steps,
  };
}
