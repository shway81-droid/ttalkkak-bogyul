// 말놀이 모둠 대항: 문제 → 의논 10초 → 차례 모둠이 답 → [맞혔어요]면 ★ 하고 다음 모둠.
// 모든 시간은 tick 으로만 줄인다(setTimeout 금지).
import { h, fill } from '../ui/dom.js';
import { WORD_TYPES } from '../core/wordTypes.js';

export const DISCUSS_SEC = 10;
const FLASH_MS = 2000;

function promptSize(text) {
  const n = [...text].length;
  if (n <= 6) return 'xl';
  if (n <= 12) return 'lg';
  if (n <= 24) return 'md';
  return 'sm';
}

export function mount(el, ctx) {
  const { deck } = ctx.step.content;
  let item = null;
  let originTurn = 0;
  let discussMs = 0;
  let flashMs = 0;
  let hintShown = false;
  let mode = 'ask'; // ask | flash | revealed

  function newItem() {
    item = deck.next();
    originTurn = ctx.api.currentTurn();
    discussMs = DISCUSS_SEC * 1000;
    hintShown = false;
    mode = 'ask';
    ctx.gate.mark();
    render();
  }

  // 버튼이 같은 자리에서 바뀌므로(두 번 누름의 두 번째가 새 버튼에 닿음) ctx.gate 로 막는다.
  const ready = () => ctx.gate.ready();

  const onHint = ctx.guard(() => {
    if (mode !== 'ask' || !item.hint || !ready()) return;
    hintShown = true;
    render();
  });

  const onReveal = ctx.guard(() => {
    if (mode !== 'ask' || !ready()) return;
    mode = 'revealed';
    ctx.gate.mark();
    render();
  });

  const onCorrect = ctx.guard(() => {
    if (mode !== 'ask' || !ready()) return;
    ctx.api.awardTurn();
    ctx.sfx.correct();
    mode = 'flash';
    flashMs = FLASH_MS;
    render();
  });

  const onPass = ctx.guard(() => {
    if (mode !== 'ask' || !ready()) return;
    ctx.api.passTurn();
    if (ctx.api.currentTurn() === originTurn) {
      // 모든 모둠이 한 번씩 기회를 가졌다 → 정답 공개
      mode = 'revealed';
      ctx.gate.mark();
    } else {
      discussMs = DISCUSS_SEC * 1000;
    }
    render();
  });

  // 아무도 맞히지 못한 문제를 마치면 다음 모둠이 새 문제를 받는다.
  const onNextItem = ctx.guard(() => {
    if (mode !== 'revealed' || !ready()) return;
    ctx.api.passTurn();
    newItem();
  });

  function answerBlock() {
    const also = item.also && item.also.length ? h('p', { class: 'word-also' }, `다른 정답: ${item.also.join(', ')}`) : null;
    return h('div', { class: 'word-answer', 'data-answer': '' },
      h('p', { class: 'word-answer-main' }, '정답: ', h('strong', null, item.answer)),
      also,
      item.note ? h('p', { class: 'word-note' }, item.note) : null,
    );
  }

  function render() {
    const type = WORD_TYPES[item.type] || { title: '말놀이', ask: '' };
    const turn = ctx.api.currentTurn();
    const sec = Math.max(0, Math.ceil(discussMs / 1000));
    let who;
    if (mode === 'flash') who = h('div', { class: 'who who-ok', 'data-turn': String(turn) }, '⭕ 맞혔어요! ★ +1');
    else if (mode === 'revealed') who = h('div', { class: 'who', 'data-turn': String(turn) }, '정답을 함께 확인해요');
    else {
      who = h('div', { class: 'who', 'data-turn': String(turn) },
        `${turn + 1}모둠 차례 · `,
        h('span', { 'data-discuss': String(sec) }, sec > 0 ? `의논 ${sec}초` : '답해요!'));
    }

    let buttons;
    if (mode === 'ask') {
      buttons = [
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'hint', disabled: !item.hint || hintShown, onClick: onHint }, '💡 힌트'),
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'reveal', onClick: onReveal }, '정답 보기'),
        h('button', { class: 'btn btn-big btn-ok', type: 'button', 'data-act': 'correct', onClick: onCorrect }, '⭕ 맞혔어요 (+★)'),
        h('button', { class: 'btn btn-big btn-warn', type: 'button', 'data-act': 'pass', onClick: onPass }, '➡ 다음 모둠에게'),
      ];
    } else if (mode === 'revealed') {
      buttons = [h('button', { class: 'btn btn-big btn-go', type: 'button', 'data-act': 'next-item', onClick: onNextItem }, '다음 문제 ▶')];
    } else {
      buttons = [h('p', { class: 'teacher-note' }, '잠시 뒤 다음 문제가 나와요')];
    }

    fill(el,
      h('div', { class: 'word' },
        who,
        h('p', { class: 'word-tag' }, `${type.title}${item.topic ? ` · ${item.topic}` : ''}`),
        h('p', { class: 'word-ask' }, type.ask),
        h('p', { class: `word-prompt size-${promptSize(item.prompt)}${item.type === 'choseong' ? ' spaced' : ''}`, 'data-prompt': '' }, item.prompt),
        hintShown && mode === 'ask' ? h('p', { class: 'word-hint' }, `💡 ${item.hint}`) : null,
        mode !== 'ask' ? answerBlock() : null,
      ),
      h('div', { class: 'act-buttons' }, buttons),
    );
  }

  newItem();

  return {
    tick(dt) {
      if (mode === 'ask' && discussMs > 0) {
        const before = Math.ceil(discussMs / 1000);
        discussMs = Math.max(0, discussMs - dt);
        if (Math.ceil(discussMs / 1000) !== before) render();
      } else if (mode === 'flash') {
        flashMs -= dt;
        if (flashMs <= 0) newItem();
      }
    },
    // 별판에서 되돌리기를 누르면 차례가 바뀔 수 있으니 차례 표시를 다시 그린다.
    onStars() {
      if (mode === 'ask') render();
    },
    destroy() {},
  };
}
