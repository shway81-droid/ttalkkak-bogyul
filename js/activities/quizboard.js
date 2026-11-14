// 상식 퀴즈 판: 모든 모둠이 함께 의논하고 손가락으로 보기 번호를 든다.
// 정답을 본 뒤 맞힌 모둠을 켜고 [별 주고 다음 문제] 한 번으로 ★을 준다. 차례 개념은 쓰지 않는다.
import { h, fill } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
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
  // 의논 시계는 이 칸만 고친다. 화면 전체를 1초마다 다시 그리면 누르는 사이 버튼이 바뀌어 클릭이 사라진다.
  let discussSpan = null;
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

  // 두 번 누르면 켜졌다 바로 꺼지므로(맞힌 모둠이 별을 못 받음) 모둠마다 막는다
  const toggles = Array.from({ length: ctx.teamCount }, (_, t) => ctx.guard(() => toggle(t)));

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

  const discussText = (sec) => (sec > 0 ? [`모든 모둠 의논 ${sec}초`] : [icon('hand'), ' 손가락을 들어요!']);

  function updateDiscuss() {
    if (!discussSpan) return;
    const sec = Math.max(0, Math.ceil(discussMs / 1000));
    discussSpan.setAttribute('data-discuss', String(sec));
    discussSpan.replaceChildren(...discussText(sec));
  }

  function render() {
    const sec = Math.max(0, Math.ceil(discussMs / 1000));
    discussSpan = mode === 'revealed' ? null : h('span', { 'data-discuss': String(sec) }, discussText(sec));
    const banner = mode === 'revealed'
      ? h('div', { class: 'who who-ok' }, '정답을 확인해요')
      : h('div', { class: 'who' }, discussSpan);

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
            class: 'team-toggle', type: 'button', 'data-act': `team-toggle-${t}`, 'aria-pressed': String(v), onClick: toggles[t],
          }, `${t + 1}모둠`)),
        ),
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'all-correct', onClick: allCorrect }, '모두 맞혔어요'),
        h('button', { class: 'btn btn-big btn-ok', type: 'button', 'data-act': 'award-and-next', onClick: onAwardNext }, '별 주고 다음 문제 ', icon('chevron-right')),
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
    ctx.api.live?.({
      kind: 'choice',
      label: '상식 퀴즈',
      prompt: item.q,
      answer: item.a,
      options: options.map((o) => ({ text: o, correct: o === item.a })),
    });
  }

  newItem();

  return {
    tick(dt) {
      if (mode !== 'ask' || discussMs <= 0) return;
      const before = Math.ceil(discussMs / 1000);
      discussMs = Math.max(0, discussMs - dt);
      const now = Math.ceil(discussMs / 1000);
      if (now !== before) {
        updateDiscuss();
        if (now >= 1 && now <= 3) ctx.sfx.tick?.();
      }
    },
    destroy() {},
  };
}
