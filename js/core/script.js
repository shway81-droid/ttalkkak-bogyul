// 화면 없이 말과 칠판만으로 40분을 진행하는 선생님용 진행 대본 내용.
import { WORD_TYPES } from './wordTypes.js';

export const TALLY = '칠판에 모둠별로 바를 정(正) 자를 써서 별을 셉니다';

const MARKS = ['①', '②', '③', '④'];
const COUNTS = { word: 10, gesture: 15, quizboard: 10 };

const draw = (deck, n) => Array.from({ length: Math.min(n, deck.size) }, () => deck.next());

// 정답 자리를 문항 id 로 정해, 같은 문항은 늘 같은 순서로 나오게 한다.
function answerSlot(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 4;
}

function quizLine(item) {
  const opts = item.o.slice();
  const slot = answerSlot(item.id);
  opts.splice(slot, 0, item.a);
  const choices = opts.map((o, i) => `${MARKS[i]} ${o}`).join('  ');
  const head = item.emoji ? `${item.emoji} ${item.q}` : item.q;
  return { q: `${head}  ${choices}`, a: `${MARKS[slot]} ${item.a}` };
}

function wordLine(w) {
  const type = WORD_TYPES[w.type];
  const a = w.also && w.also.length ? `${w.answer} (${w.also.join(', ')})` : w.answer;
  return { q: `[${type.title}] ${w.prompt}`, a };
}

function section(step) {
  const { kind, title, minutes, content } = step;
  const base = { minutes, title };
  switch (kind) {
    case 'greet':
      return {
        ...base,
        how: [
          '칠판에 선생님 이름을 쓰고 인사합니다.',
          '지금 앉은 자리대로 모둠을 정합니다(모둠 자리가 아니면 줄·분단으로).',
          '약속: 차례 모둠만 답하기, 친구 말 끝까지 듣기.',
          '별 받는 법: 맞히면 ★, 발표해도 ★, 끝까지 함께하면 ★.',
        ],
      };
    case 'word':
      return {
        ...base,
        how: [
          '모둠 차례대로 문제를 읽어 주거나 칠판에 씁니다. 10초 의논한 뒤 차례 모둠이 답합니다.',
          '맞히면 그 모둠에 ★, 틀리면 다음 모둠에게 기회를 넘깁니다. 다른 모둠은 먼저 외치지 않습니다.',
        ],
        items: draw(content.deck, COUNTS.word).map(wordLine),
      };
    case 'gesture':
      return {
        ...base,
        how: [
          '차례 모둠 대표 한 명이 칠판을 보지 않고 앞에 섭니다. 선생님이 모둠 친구들에게만 제시어를 보여 줍니다.',
          '친구들은 말없이 몸으로 설명하고, 1분 안에 맞히면 ★. 다음 모둠으로 넘어갑니다.',
        ],
        words: draw(content.deck, COUNTS.gesture).map((w) => w.word),
      };
    case 'quizboard':
      return {
        ...base,
        how: [
          '문제와 보기를 읽어 줍니다. 모든 모둠이 15초 의논합니다.',
          '"하나, 둘, 셋!" 신호에 모둠마다 손가락으로 보기 번호를 듭니다. 맞힌 모둠마다 ★.',
        ],
        items: draw(content.deck, COUNTS.quizboard).map(quizLine),
      };
    case 'story': {
      const s = content.story;
      return {
        ...base,
        how: [
          '이야기 읽기(1분) → 혼자 생각하기(30초) → 모둠과 이야기 나누기(1분 30초) → 발표하기(2분) → 생각 넓히기(1분 30초).',
          '정답은 없습니다. 발표한 모둠에 ★.',
        ],
        story: { title: s.title, text: s.story.slice(), questions: [s.mainQuestion, ...(s.followUpQuestions || [])] },
      };
    }
    case 'draw': {
      const d = content.drawing;
      const steps = [];
      let acc = [];
      for (const st of d.steps) {
        acc = acc.concat(st.d);
        steps.push(acc.slice());
      }
      return {
        ...base,
        how: [
          `${d.setupSay || '종이와 연필을 준비합니다.'}`,
          '아래 그림을 한 단계씩 칠판에 따라 그려 보여 줍니다. 다 그리면 색칠하고 꾸미기를 합니다.',
          '끝까지 함께 그리면 모든 모둠에 ★.',
        ],
        drawing: { title: d.title, steps, viewBox: d.viewBox, decorate: content.decorate },
      };
    }
    case 'celebrate':
      return {
        ...base,
        how: [
          '모둠별 별을 모두 더해 "오늘 우리 반 별 ○개!"라고 함께 축하합니다. 모둠끼리 비교하지 않습니다.',
          '가장 재미있었던 순서에 손을 들어 봅니다.',
        ],
      };
    default:
      return { ...base, how: [] };
  }
}

export function buildScript(plan) {
  return { title: plan.title, sections: plan.steps.map(section), tally: TALLY };
}
