// 상식 퀴즈 판: 모든 모둠이 함께 의논하고 손가락으로 보기 번호를 든다.
// 정답을 본 뒤 맞힌 모둠을 켜고 [별 주고 다음 문제] 한 번으로 ★을 준다. 차례 개념은 쓰지 않는다.
import { h, fill } from '../ui/dom.js';
import { makeRng, shuffle } from '../core/rng.js';

export const QUIZ_DISCUSS_SEC = 15;
const MARKS = ['①', '②', '③', '④'];

export function mount(el, ctx) {
  const { deck } = ctx.step.content;
  const rng = makeRng(Math.floor(Math.random() * 4294967296));
  let item = null;
  let options = [];
  let discussMs = 0;
  let mode = 'ask'; // ask | revealed
  let on = [];
  // [정답 보기]를 두 번 누르면 두 번째 누름이 그 자리에 새로 나온 모둠 버튼을 켤 수 있다. ctx.gate 로 막는다.
  const settled = () => ctx.gate.ready();

  function newItem() {
    item = deck.next();
    options = shuffle([item.a, ...item.o], rng);
    discussMs = QUIZ_DISCUSS_SEC * 1000;
    mode = 'ask';
    on = Array(ctx.teamCount).fill(false);
    ctx.gate.mark();
    render();
  }

  const onReveal = ctx.guard(() => {
    if (mode !== 'ask' || !settled()) return;
    mode = 'revealed';
    ctx.gate.mark();
    render();
  });

  function toggle(t) {
    if (mode !== 'revealed' || !settled()) return;
    on[t] = !on[t];
    render();
  }

  function allCorrect() {
    if (mode !== 'revealed' || !settled()) return;
    on = on.map(() => true);
    render();
  }

  const onAwardNext = ctx.guard(() => {
    if (mode !== 'revealed' || !settled()) return;
    const teams = on.flatMap((v, i) => (v ? [i] : []));
    if (teams.length) {
      ctx.api.awardTeams(teams);
      ctx.sfx.correct();
    }
    newItem();
  });

  function render() {
    const sec = Math.max(0, Math.ceil(discussMs / 1000));
    const banner = mode === 'revealed'
      ? h('div', { class: 'who who-ok' }, '정답을 확인해요')
      : h('div', { class: 'who' },
        h('span', { 'data-discuss': String(sec) }, sec > 0 ? `모든 모둠 의논 ${sec}초` : '✋ 손가락을 들어요!'));

    const opts = options.map((o, i) => {
      const correct = o === item.a;
      const cls = mode === 'revealed' ? (correct ? 'quiz-opt correct' : 'quiz-opt dim') : 'quiz-opt';
      return h('li', { class: cls, 'data-option': String(i) }, h('span', { class: 'quiz-mark' }, MARKS[i]), ' ', o);
    });

    let buttons;
    if (mode === 'ask') {
      buttons = [h('button', { class: 'btn btn-big btn-go', type: 'button', 'data-act': 'reveal', onClick: onReveal }, '정답 보기')];
    } else {
      buttons = [
        h('div', { class: 'quiz-teams', role: 'group', 'aria-label': '맞힌 모둠 고르기' },
          h('span', { class: 'quiz-teams-label' }, '맞힌 모둠:'),
          on.map((v, t) => h('button', {
            class: 'team-toggle', type: 'button', 'data-act': `team-toggle-${t}`, 'aria-pressed': String(v), onClick: () => toggle(t),
          }, `${t + 1}모둠`)),
        ),
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'all-correct', onClick: allCorrect }, '모두 맞혔어요'),
        h('button', { class: 'btn btn-big btn-ok', type: 'button', 'data-act': 'award-and-next', onClick: onAwardNext }, '별 주고 다음 문제 ▶'),
      ];
    }

    fill(el,
      h('div', { class: 'quiz' },
        banner,
        item.emoji ? h('div', { class: 'quiz-emoji', 'aria-hidden': 'true' }, item.emoji) : null,
        h('p', { class: `quiz-q${[...item.q].length > 30 ? ' long' : ''}`, 'data-prompt': '' }, item.q),
        h('ol', { class: 'quiz-opts' }, opts),
      ),
      h('div', { class: 'act-buttons quiz-buttons' }, buttons),
    );
  }

  newItem();

  return {
    tick(dt) {
      if (mode !== 'ask' || discussMs <= 0) return;
      const before = Math.ceil(discussMs / 1000);
      discussMs = Math.max(0, discussMs - dt);
      if (Math.ceil(discussMs / 1000) !== before) render();
    },
    destroy() {},
  };
}
