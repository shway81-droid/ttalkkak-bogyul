// 선생님용 진행 대본(A4 한 장): print.html?grade=3&flow=lively
// 화면 없이 말과 칠판만으로 40분을 진행할 수 있게 순서별 진행 방법·문제·정답을 싣는다.
// 한 장을 넘치면 글자를 줄이지 않고 문항 수를 줄인다.
import { loadData } from './core/data.js';
import { buildPlan } from './core/plan.js';
import { makeRng } from './core/rng.js';
import { buildScript } from './core/script.js';
import { h, fill } from './ui/dom.js';

// 문항 수 단계: 넘치면 다음 단계로(설계: word·quiz·person 10→8, gesture 15→12).
export const LEVELS = [
  { word: 10, quizboard: 10, person: 10, gesture: 15 },
  { word: 8, quizboard: 8, person: 8, gesture: 12 },
  { word: 6, quizboard: 6, person: 6, gesture: 10 },
];

// A4 297mm − 위아래 여백 12mm×2 = 273mm. 화면과 인쇄의 줄바꿈 차이를 생각해 조금 남긴다.
const PAGE_MM = 273;
const SAFETY_MM = 5;
const PX_PER_MM = 96 / 25.4;

const sheet = document.getElementById('sheet');

function sectionBody(sec, kind, level) {
  const parts = [h('ul', { class: 'how' }, sec.how.map((l) => h('li', null, l)))];
  if (sec.items) {
    const n = level[kind];
    parts.push(h('ol', { class: `items items-${kind}` },
      sec.items.slice(0, n).map((it) => h('li', null,
        h('span', { class: 'q' }, it.q), ' ',
        h('span', { class: 'a' }, `→ ${it.a}`)))));
  }
  if (sec.words) {
    parts.push(h('p', { class: 'words-label' }, '제시어 (모둠 친구들에게만 보여 주세요)'));
    parts.push(h('ol', { class: 'words' }, sec.words.slice(0, level.gesture).map((w) => h('li', null, w))));
  }
  if (sec.story) {
    const [main, ...follow] = sec.story.questions;
    parts.push(h('div', { class: 'story' },
      h('p', { class: 'story-title' }, `「${sec.story.title}」`),
      h('p', { class: 'story-text' }, sec.story.text.join(' ')),
      h('p', { class: 'story-q' }, `❓ ${main}`),
      follow.length ? h('ul', { class: 'story-follow' }, follow.map((f) => h('li', null, f))) : null));
  }
  return parts;
}

function render(plan, script, level) {
  let start = 0;
  fill(sheet,
    h('header', { class: 'head' },
      h('h1', null, '딸깍 보결 진행 대본'),
      h('p', { class: 'head-sub' }, `${script.title} · 40분 · 화면 없이 말과 칠판으로 진행할 때`)),
    h('div', { class: 'cols' },
      script.sections.map((sec, i) => {
        const kind = plan.steps[i].kind;
        const from = start;
        start += sec.minutes;
        return h('section', { class: `sec sec-${kind}`, 'data-kind': kind },
          h('h2', null,
            h('span', { class: 'no' }, String(i + 1)), ` ${sec.title} `,
            h('span', { class: 'min' }, `${sec.minutes}분 (${from}~${start}분)`)),
          sectionBody(sec, kind, level));
      })),
    h('footer', { class: 'foot' },
      h('p', { class: 'tally' }, `★ 별 세기: ${script.tally}. 모둠끼리 비교하지 않고 “우리 반 별”로 함께 셉니다.`),
      h('p', { class: 'credit' }, '딸깍 보결 · 문항·이야기·인물: 짬짬이')));
}

const fits = () => sheet.getBoundingClientRect().height <= (PAGE_MM - SAFETY_MM) * PX_PER_MM;

function showError(msg) {
  fill(sheet, h('p', { class: 'error' }, msg), h('p', null, h('a', { href: './' }, '처음 화면으로')));
}

async function main() {
  const params = new URLSearchParams(location.search);
  const grade = Number(params.get('grade'));
  const flow = params.get('flow') || 'lively';
  try {
    const data = await loadData();
    const set = data.sets.find((s) => s.grade === grade && s.flow === flow);
    if (!set) {
      showError('학년과 흐름을 찾지 못했어요. 처음 화면에서 학년을 고른 뒤 [진행 대본 인쇄]를 눌러 주세요.');
      return;
    }
    document.title = `진행 대본 ${set.grade}학년 · 딸깍 보결`;
    const plan = buildPlan(set, data, makeRng(Date.now() >>> 0));
    const script = buildScript(plan);
    if (document.fonts?.ready) await document.fonts.ready;
    // 몇 번째 단계에서 맞았는지 남긴다(마지막 단계로도 넘치면 'overflow').
    sheet.dataset.level = 'overflow';
    for (let i = 0; i < LEVELS.length; i++) {
      render(plan, script, LEVELS[i]);
      if (fits()) {
        sheet.dataset.level = String(i);
        break;
      }
    }
  } catch (err) {
    showError('자료를 읽지 못했어요. 새로고침해 주세요.');
    throw err;
  } finally {
    document.body.dataset.ready = '1';
  }
}

document.querySelector('[data-act="print-now"]').addEventListener('click', () => window.print());
main();
