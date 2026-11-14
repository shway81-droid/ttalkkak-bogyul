// 첫 화면: 학년 → 흐름 → 모둠 수 → [시작]. 고른 값은 저장하지 않는다.
import { h, fill } from './dom.js';
import { icon } from './icons.js';
import { openAnswerWindow } from './live.js';
import { FLOWS } from '../core/flows.js';

const SLOT_COLOR = { greet: 'n', word: 'h', team: 'h', person: 'h', story: 'm', celebrate: 'n' };
const SLOT_NAME = { greet: '인사', word: '말놀이', team: '모둠 놀이', person: '인물 퀴즈', story: '이야기', celebrate: '축하' };
const TEAM_CHOICES = [4, 5, 6, 7, 8];

export function renderStart(root, { sets, onStart, onPrint }) {
  const sel = { grade: null, flow: 'lively', teams: 6 };
  const grades = [...new Set(sets.map((s) => s.grade))].sort((a, b) => a - b);

  const gradeBtns = grades.map((g) =>
    h('button', { class: 'chip', type: 'button', 'data-act': `grade-${g}`, 'aria-pressed': 'false', onClick: () => choose('grade', g) }, `${g}학년`),
  );
  const flowCards = Object.entries(FLOWS).map(([id, f]) =>
    h('button', { class: 'flow-card', type: 'button', 'data-act': `flow-${id}`, 'aria-pressed': 'false', onClick: () => choose('flow', id) },
      h('span', { class: 'flow-name' }, icon(f.icon), ` ${f.label}`),
      h('span', { class: 'flow-bar', 'aria-hidden': 'true' },
        f.slots.map(([slot, min]) => h('i', { class: `seg seg-${SLOT_COLOR[slot]}`, style: { flexGrow: String(min) }, title: `${SLOT_NAME[slot]} ${min}분` })),
      ),
      h('span', { class: 'flow-order' }, f.slots.map(([slot]) => SLOT_NAME[slot]).join(' → ')),
      h('span', { class: 'flow-blurb' }, f.blurb),
    ),
  );
  const teamBtns = TEAM_CHOICES.map((n) =>
    h('button', { class: 'chip', type: 'button', 'data-act': `teams-${n}`, 'aria-pressed': 'false', onClick: () => choose('teams', n) }, String(n)),
  );
  const startBtn = h('button', { class: 'btn btn-go', type: 'button', 'data-act': 'start', disabled: true, onClick: () => onStart({ ...sel }) }, icon('play', { fill: true }), ' 시작');
  const printHint = h('span', { class: 'print-hint', role: 'status' });
  // 선생님용 실시간 정답 창: 수업 화면의 문제 정답을 노트북 화면에 미리 띄운다(js/ui/live.js)
  const answerBtn = h('button', { class: 'print-link', type: 'button', 'data-act': 'open-answer', onClick: openAnswerWindow },
    icon('eye'), ' 선생님용 정답 창 열기 (노트북 화면에 두면 정답을 미리 볼 수 있어요)');
  const printBtn = h('button', { class: 'print-link', type: 'button', 'data-act': 'print', onClick: printClick },
    icon('printer'), ' 화면을 못 쓰나요? 선생님용 진행 대본 인쇄');

  function printClick() {
    if (!sel.grade) {
      printHint.textContent = '학년을 먼저 골라 주세요';
      return;
    }
    printHint.textContent = '';
    onPrint({ grade: sel.grade, flow: sel.flow });
  }

  function choose(key, value) {
    sel[key] = value;
    sync();
  }

  function sync() {
    gradeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(grades[i] === sel.grade)));
    flowCards.forEach((b, i) => b.setAttribute('aria-pressed', String(Object.keys(FLOWS)[i] === sel.flow)));
    teamBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(TEAM_CHOICES[i] === sel.teams)));
    startBtn.disabled = !sel.grade;
    if (sel.grade) printHint.textContent = '';
  }

  fill(root,
    h('main', { class: 'start', 'data-view': 'start' },
      h('header', { class: 'brand' },
        h('h1', null, '딸깍 ', h('em', null, '보결')),
        h('p', null, '학년만 누르면 40분 수업이 시작돼요'),
      ),
      h('section', { class: 'pick-row' },
        h('h2', { class: 'pick-label' }, '몇 학년인가요?'),
        h('div', { class: 'chips' }, gradeBtns),
      ),
      h('section', { class: 'pick-row pick-flows' },
        h('h2', { class: 'pick-label' }, '어떻게 시작할까요?'),
        h('div', { class: 'flows' }, flowCards),
      ),
      h('section', { class: 'pick-row' },
        h('h2', { class: 'pick-label' }, '모둠은 몇 개?'),
        h('div', { class: 'chips' }, teamBtns),
      ),
      h('div', { class: 'start-bottom' }, h('div', { class: 'print-box' }, answerBtn, printBtn, printHint), startBtn),
      h('footer', { class: 'credit' }, '문항·이야기·인물: 짬짬이 · ', h('a', { href: 'credits.html', 'data-act': 'credits' }, '인물 사진 출처')),
    ),
  );
  sync();
}
