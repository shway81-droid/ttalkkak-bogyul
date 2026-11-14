// 말놀이 모둠 대항: 문제 → 의논 10초 → 차례 모둠이 답 → [맞혔어요]면 ★ 하고 다음 모둠.
// 인물 퀴즈(kind person)도 같은 진행이다. 문제 대신 사진을 크게 보여 주고, 정답이 나오면 사진 출처를 붙인다.
// 모든 시간은 tick 으로만 줄인다(setTimeout 금지).
import { h, fill } from '../ui/dom.js';
import { icon, star } from '../ui/icons.js';
import { WORD_TYPES, PERSON_TYPE } from '../core/wordTypes.js';

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
  const isPerson = ctx.step.kind === 'person';
  let item = null;
  // 사진은 문제마다 한 번만 만든다(화면을 다시 그릴 때마다 새로 만들면 깜빡인다).
  let photo = null;
  let originTurn = 0;
  let discussMs = 0;
  let flashMs = 0;
  let hintShown = false;
  let mode = 'ask'; // ask | flash | revealed
  // 의논 시계는 이 칸만 고친다. 화면 전체를 1초마다 다시 그리면 누르는 사이 버튼이 바뀌어 클릭이 사라진다.
  let discussSpan = null;

  function newItem() {
    item = deck.next();
    // alt 는 비운다: 화면 읽기 프로그램이 정답을 읽어 주지 않게(짬짬이와 같음)
    photo = isPerson ? h('img', { class: 'person-photo', src: item.photo.file, alt: '', draggable: 'false', 'data-photo': '' }) : null;
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
    ctx.sfx.pass();
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

  const discussText = (sec) => (sec > 0 ? `의논 ${sec}초` : '답해요!');

  function updateDiscuss() {
    if (!discussSpan) return;
    const sec = Math.max(0, Math.ceil(discussMs / 1000));
    discussSpan.setAttribute('data-discuss', String(sec));
    discussSpan.textContent = discussText(sec);
  }

  function answerBlock() {
    const also = item.also && item.also.length ? h('p', { class: 'word-also' }, `다른 정답: ${item.also.join(', ')}`) : null;
    return h('div', { class: 'word-answer', 'data-answer': '' },
      h('p', { class: 'word-answer-main' }, '정답: ', h('strong', null, item.answer)),
      also,
      item.note ? h('p', { class: 'word-note' }, item.note) : null,
    );
  }

  function render() {
    const type = isPerson ? PERSON_TYPE : WORD_TYPES[item.type] || { title: '말놀이', ask: '' };
    const turn = ctx.api.currentTurn();
    const sec = Math.max(0, Math.ceil(discussMs / 1000));
    let who;
    discussSpan = null;
    if (mode === 'flash') who = h('div', { class: 'who who-ok', 'data-turn': String(turn) }, icon('circle-check'), ' 맞혔어요! ', star(), ' +1');
    else if (mode === 'revealed') who = h('div', { class: 'who', 'data-turn': String(turn) }, '정답을 함께 확인해요');
    else {
      discussSpan = h('span', { 'data-discuss': String(sec) }, discussText(sec));
      who = h('div', { class: 'who', 'data-turn': String(turn) }, `${turn + 1}모둠 차례 · `, discussSpan);
    }

    let buttons;
    if (mode === 'ask') {
      buttons = [
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'hint', disabled: !item.hint || hintShown, onClick: onHint }, icon('lightbulb'), ' 힌트'),
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'reveal', onClick: onReveal }, '정답 보기'),
        h('button', { class: 'btn btn-big btn-ok', type: 'button', 'data-act': 'correct', onClick: onCorrect }, icon('circle-check'), ' 맞혔어요 (+', star(), ')'),
        h('button', { class: 'btn btn-big btn-warn', type: 'button', 'data-act': 'pass', onClick: onPass }, icon('arrow-right'), ' 다음 모둠에게'),
      ];
    } else if (mode === 'revealed') {
      buttons = [h('button', { class: 'btn btn-big btn-go', type: 'button', 'data-act': 'next-item', onClick: onNextItem }, '다음 문제 ', icon('chevron-right'))];
    } else {
      buttons = [h('p', { class: 'teacher-note' }, isPerson ? '잠시 뒤 다음 인물이 나와요' : '잠시 뒤 다음 문제가 나와요')];
    }

    const tag = h('p', { class: 'word-tag' }, `${type.title}${item.topic ? ` · ${item.topic}` : ''}`);
    const ask = h('p', { class: 'word-ask' }, type.ask);
    const hint = hintShown && mode === 'ask' ? h('p', { class: 'word-hint' }, icon('lightbulb'), ` ${item.hint}`) : null;
    const answer = mode !== 'ask' ? answerBlock() : null;
    const body = isPerson
      ? h('div', { class: 'word person' },
        who,
        h('div', { class: 'person-main' },
          h('figure', { class: 'person-figure' },
            photo,
            // 사진 출처는 정답이 나온 뒤에: 원본 주소·저작자에 이름이 들어 있을 수 있다
            mode !== 'ask' ? h('figcaption', { class: 'person-credit', 'data-credit': '' }, `사진: ${item.photo.author} · ${item.photo.license}`) : null),
          h('div', { class: 'person-side' },
            tag,
            ask,
            h('p', { class: 'word-prompt size-lg', 'data-prompt': '' }, item.prompt),
            hint,
            answer)))
      : h('div', { class: 'word' },
        who,
        tag,
        ask,
        h('p', { class: `word-prompt size-${promptSize(item.prompt)}${item.type === 'choseong' ? ' spaced' : ''}`, 'data-prompt': '' }, item.prompt),
        hint,
        answer);

    fill(el, body, h('div', { class: 'act-buttons' }, buttons));
    sendLive();
  }

  // 선생님용 정답 창에 지금 문제의 정답을 알린다(차례가 바뀌어도 다시 그리므로 함께 알려진다)
  function sendLive() {
    ctx.api.live?.({
      kind: 'quiz',
      label: isPerson ? PERSON_TYPE.title : (WORD_TYPES[item.type]?.title || '말놀이'),
      topic: item.topic,
      prompt: item.prompt,
      photo: isPerson ? item.photo.file : null,
      answer: item.answer,
      also: item.also,
      note: item.note,
      hint: item.hint,
    });
  }

  newItem();

  return {
    tick(dt) {
      if (mode === 'ask' && discussMs > 0) {
        const before = Math.ceil(discussMs / 1000);
        discussMs = Math.max(0, discussMs - dt);
        const now = Math.ceil(discussMs / 1000);
        if (now !== before) {
          updateDiscuss();
          if (now >= 1 && now <= 3) ctx.sfx.tick?.();
        }
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
