// 몸으로 말해요: 차례 모둠 대표가 화면을 등지고, 모둠 친구들이 말없이 몸으로 설명한다.
// 한 차례는 1분. 그동안 맞힐 때마다 별 하나와 다음 낱말, 어려우면 [넘기기]로 다음 낱말(별 없음).
// 1분이 끝나면(또는 [차례 끝]) "n모둠 ○개 맞혔어요!"를 보여 주고 다음 모둠 준비 화면으로 간다.
// 준비 화면에서는 낱말을 DOM 에 넣지 않는다(미리 보이지 않게).
import { h, fill } from '../ui/dom.js';
import { icon, star } from '../ui/icons.js';
import { bump } from '../ui/fx.js';

export const GESTURE_SEC = 60;

export function mount(el, ctx) {
  const { deck } = ctx.step.content;
  let mode = 'ready'; // ready | word
  let word = null;
  let remainMs = 0;
  let count = 0; // 이번 차례에 맞힌 낱말 수
  let lastResult = null; // 바로 앞 차례 결과 한 줄
  // 남은 시간은 이 칸만 고친다. 화면 전체를 1초마다 다시 그리면 누르는 사이 버튼이 바뀌어 클릭이 사라진다.
  let leftSpan = null;
  // 버튼을 두 번 누르면 두 번째 누름이 그 자리에 새로 나온 낱말·버튼에 닿는다
  // ([낱말 보이기]→[맞혔어요], [맞혔어요]→다음 낱말의 [맞혔어요]). ctx.gate 로 막는다.
  const settled = () => ctx.gate.ready();

  function nextWord() {
    word = deck.next();
    ctx.gate.mark();
    render();
  }

  const onShow = ctx.guard(() => {
    if (mode !== 'ready' || !settled()) return;
    remainMs = GESTURE_SEC * 1000;
    count = 0;
    mode = 'word';
    nextWord();
  });

  function endRound() {
    if (mode !== 'word') return;
    const team = ctx.api.currentTurn();
    lastResult = count > 0
      ? [icon('trophy'), ` ${team + 1}모둠 ${count}개 맞혔어요! `, star(), ` +${count}`]
      : `${team + 1}모둠 수고했어요! 마지막 낱말은 '${word.word}'였어요`;
    ctx.api.passTurn();
    word = null;
    mode = 'ready';
    ctx.gate.mark();
    render();
  }

  const onCorrect = ctx.guard(() => {
    if (mode !== 'word' || !settled()) return;
    ctx.api.addStar(ctx.api.currentTurn());
    ctx.sfx.correct();
    count += 1;
    nextWord();
    bump(el.querySelector('[data-count]'));
  });

  const onPass = ctx.guard(() => {
    if (mode !== 'word' || !settled()) return;
    ctx.sfx.pass();
    nextWord();
  });

  const onEnd = ctx.guard(() => {
    if (mode !== 'word' || !settled()) return;
    endRound();
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
          h('p', { class: 'gesture-sub' }, `1분 동안 맞힌 낱말마다 별 하나! 어려우면 넘겨도 돼요`),
        ),
        h('div', { class: 'act-buttons' },
          h('button', { class: 'btn btn-huge btn-go', type: 'button', 'data-act': 'show-word', onClick: onShow }, icon('play', { fill: true }), ' 1분 시작'),
        ),
      );
      ctx.api.live?.({ kind: 'idle', message: `몸으로 말해요 · ${turn + 1}모둠 준비 중이에요` });
      return;
    }
    const sec = Math.max(0, Math.ceil(remainMs / 1000));
    leftSpan = h('span', { 'data-left': String(sec) }, leftText(sec));
    fill(el,
      h('div', { class: 'gesture' },
        h('div', { class: 'who', 'data-turn': String(turn) }, `${turn + 1}모둠 · `, leftSpan),
        h('p', { class: 'gesture-count', 'data-count': String(count) }, '맞힌 낱말 ', star(), ` ${count}개`),
        h('p', { class: 'gesture-topic' }, word.topic ? `주제: ${word.topic}` : ''),
        h('p', { class: 'gesture-word', 'data-word': '' }, word.word),
        h('p', { class: 'gesture-sub' }, icon('mic-off'), ' 말하지 않고 몸으로만 · 다른 모둠은 답을 말하지 않아요'),
      ),
      h('div', { class: 'act-buttons' },
        h('button', { class: 'btn btn-big btn-ok', type: 'button', 'data-act': 'correct', onClick: onCorrect }, icon('circle-check'), ' 맞혔어요 (+', star(), ')'),
        h('button', { class: 'btn btn-big btn-warn', type: 'button', 'data-act': 'pass', onClick: onPass }, icon('skip-forward'), ' 넘기기'),
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'end-round', onClick: onEnd }, icon('square-stop'), ' 차례 끝'),
      ),
    );
    ctx.api.live?.({ kind: 'gesture', label: '몸으로 말해요', topic: word.topic, answer: word.word, count });
  }

  render();

  return {
    tick(dt) {
      if (mode !== 'word' || remainMs <= 0) return;
      const before = Math.ceil(remainMs / 1000);
      remainMs = Math.max(0, remainMs - dt);
      const now = Math.ceil(remainMs / 1000);
      if (now !== before) {
        updateLeft();
        if (now >= 1 && now <= 3) ctx.sfx.tick?.();
      }
      if (remainMs === 0) {
        ctx.sfx.timeUp();
        endRound();
      }
    },
    // 되돌리기로 별이 바뀌면 차례 표시가 바뀔 수 있다
    onStars() {
      if (mode === 'ready') render();
    },
    destroy() {},
  };
}
