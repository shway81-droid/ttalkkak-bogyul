// 몸으로 말해요: 차례 모둠 대표가 화면을 등지고, 모둠 친구들이 말없이 몸으로 설명한다.
// 준비 화면에서는 낱말을 DOM 에 넣지 않는다(미리 보이지 않게).
import { h, fill } from '../ui/dom.js';

export const GESTURE_SEC = 60;

export function mount(el, ctx) {
  const { deck } = ctx.step.content;
  let mode = 'ready'; // ready | word
  let word = null;
  let remainMs = 0;
  let timeUpDone = false;
  let lastResult = null; // 바로 앞 결과 한 줄
  // 남은 시간은 이 칸만 고친다. 화면 전체를 1초마다 다시 그리면 누르는 사이 버튼이 바뀌어 클릭이 사라진다.
  let leftSpan = null;
  // 버튼을 두 번 누르면 두 번째 누름이 그 자리에 새로 나온 버튼에 닿는다
  // ([낱말 보이기]→[맞혔어요], [맞혔어요]→다음 모둠의 [낱말 보이기]). ctx.gate 로 막는다.
  const settled = () => ctx.gate.ready();

  const onShow = ctx.guard(() => {
    if (mode !== 'ready' || !settled()) return;
    word = deck.next();
    remainMs = GESTURE_SEC * 1000;
    timeUpDone = false;
    mode = 'word';
    ctx.gate.mark();
    render();
  });

  function toReady(result) {
    lastResult = result;
    word = null;
    mode = 'ready';
    ctx.gate.mark();
    render();
  }

  const onCorrect = ctx.guard(() => {
    if (mode !== 'word' || !settled()) return;
    const team = ctx.api.awardTurn();
    ctx.sfx.correct();
    toReady(`⭕ ${team + 1}모둠 맞혔어요! ★ +1`);
  });

  const onPass = ctx.guard(() => {
    if (mode !== 'word' || !settled()) return;
    const team = ctx.api.currentTurn();
    const answer = word.word;
    ctx.api.passTurn();
    toReady(`${team + 1}모둠 정답은 '${answer}'였어요`);
  });

  const leftText = (sec) => (sec > 0 ? `남은 시간 ${sec}초` : '시간 끝!');

  function updateLeft() {
    if (!leftSpan) return;
    const sec = Math.max(0, Math.ceil(remainMs / 1000));
    leftSpan.setAttribute('data-left', String(sec));
    leftSpan.textContent = leftText(sec);
  }

  function render() {
    const turn = ctx.api.currentTurn();
    leftSpan = null;
    if (mode === 'ready') {
      fill(el,
        h('div', { class: 'gesture' },
          lastResult ? h('p', { class: 'gesture-last' }, lastResult) : null,
          h('div', { class: 'who', 'data-turn': String(turn) }, `${turn + 1}모둠 차례`),
          h('p', { class: 'gesture-ready' }, `${turn + 1}모둠 대표 한 명이 화면을 등지고 서요`),
          h('p', { class: 'gesture-sub' }, '모둠 친구들은 화면을 보고, 말없이 몸으로만 설명해요'),
        ),
        h('div', { class: 'act-buttons' },
          h('button', { class: 'btn btn-huge btn-go', type: 'button', 'data-act': 'show-word', onClick: onShow }, '▶ 낱말 보이기'),
        ),
      );
      return;
    }
    const sec = Math.max(0, Math.ceil(remainMs / 1000));
    leftSpan = h('span', { 'data-left': String(sec) }, leftText(sec));
    fill(el,
      h('div', { class: 'gesture' },
        h('div', { class: 'who', 'data-turn': String(turn) }, `${turn + 1}모둠 · `, leftSpan),
        h('p', { class: 'gesture-topic' }, word.topic ? `주제: ${word.topic}` : ''),
        h('p', { class: 'gesture-word', 'data-word': '' }, word.word),
        h('p', { class: 'gesture-sub' }, '🤫 말하지 않고 몸으로만 · 다른 모둠은 답을 말하지 않아요'),
      ),
      h('div', { class: 'act-buttons' },
        h('button', { class: 'btn btn-big btn-ok', type: 'button', 'data-act': 'correct', onClick: onCorrect }, '⭕ 맞혔어요 (+★)'),
        h('button', { class: 'btn btn-big btn-warn', type: 'button', 'data-act': 'pass', onClick: onPass }, '⏭ 넘기기'),
      ),
    );
  }

  render();

  return {
    tick(dt) {
      if (mode !== 'word' || remainMs <= 0) return;
      const before = Math.ceil(remainMs / 1000);
      remainMs = Math.max(0, remainMs - dt);
      if (remainMs === 0 && !timeUpDone) {
        timeUpDone = true;
        ctx.sfx.timeUp();
      }
      if (Math.ceil(remainMs / 1000) !== before) updateLeft();
    },
    onStars() {
      render();
    },
    destroy() {},
  };
}
