// 선생님용 실시간 정답 창(answer.html, 단일 파일은 #answer). 수업 화면(js/ui/runner.js)이 보낸
// "지금 화면의 문제"를 받아 정답을 크게 띄운다. 이 창은 아무것도 보내지 않는다(처음 열 때 hello 만).
//
// 받는 모양 — kind 별로 쓰는 칸만 채워 온다:
//   idle     { message }                                  규칙 안내·인사·축하 등 정답이 없는 때
//   quiz     { label, prompt, photo?, answer, also?, note?, hint? }   말놀이·인물 퀴즈(차례 모둠 turn)
//   choice   { label, prompt, options:[{text, correct}], answer }    상식 퀴즈
//   gesture  { label, answer, topic?, count?, teamOnly? }  몸으로 말해요(지금 낱말)
//   story    { label, prompt, answer, list?, guide?, ideas? }       이야기 나누기(질문·선생님 안내)
// 공통으로 set(세트 이름)·stepNo·stepTitle·turn(차례 모둠, 0부터)이 붙어 온다.
import { h, fill } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { LIVE_CHANNEL } from './ui/live.js';

const liveEl = document.getElementById('live');

function where(d) {
  if (!d.set) return null;
  return h('p', { class: 'where' }, `${d.set} · ${d.stepNo}번째 ${d.stepTitle}`);
}

const turnText = (d) => (Number.isInteger(d.turn) ? `${d.turn + 1}모둠 차례` : '');

function render(d) {
  liveEl.dataset.kind = d.kind || 'idle';
  switch (d.kind) {
    case 'quiz':
      fill(liveEl,
        where(d),
        h('p', { class: 'label' }, [d.label, d.topic, turnText(d)].filter(Boolean).join(' · ')),
        d.photo ? h('img', { class: 'photo', src: d.photo, alt: '' }) : null,
        d.prompt && !d.photo ? h('p', { class: 'prompt' }, d.prompt) : null,
        h('p', { class: 'answer-label' }, '정답'),
        h('p', { class: 'answer', 'data-answer': '' }, d.answer),
        d.also?.length ? h('p', { class: 'also' }, `이것도 정답: ${d.also.join(', ')}`) : null,
        d.note ? h('p', { class: 'note' }, d.note) : null,
        d.hint ? h('p', { class: 'hint' }, icon('lightbulb'), ` 힌트: ${d.hint}`) : null,
      );
      return;
    case 'choice':
      fill(liveEl,
        where(d),
        h('p', { class: 'label' }, d.label),
        h('p', { class: 'prompt' }, d.prompt),
        h('p', { class: 'answer-label' }, '정답'),
        h('p', { class: 'answer', 'data-answer': '' }, d.answer),
        h('ol', { class: 'options' }, d.options.map((o) => h('li', { class: o.correct ? 'correct' : '' }, o.text))),
      );
      return;
    case 'gesture':
      fill(liveEl,
        where(d),
        h('p', { class: 'label' }, [d.label, d.topic, turnText(d)].filter(Boolean).join(' · ')),
        h('p', { class: 'answer-label' }, '지금 낱말'),
        h('p', { class: 'answer', 'data-answer': '' }, d.answer),
        Number.isInteger(d.count) ? h('p', { class: 'note' }, `이번 차례에 맞힌 낱말 ${d.count}개`) : null,
      );
      return;
    case 'story':
      fill(liveEl,
        where(d),
        h('p', { class: 'label' }, d.label),
        h('p', { class: 'prompt' }, `「${d.prompt}」`),
        h('p', { class: 'answer-label' }, '중심 질문'),
        h('p', { class: 'answer story-q' }, d.answer),
        d.list?.length ? h('div', { class: 'block' }, h('p', { class: 'block-title' }, '생각 넓히기 질문'), h('ul', null, d.list.map((x) => h('li', null, x)))) : null,
        d.guide?.length ? h('div', { class: 'block' }, h('p', { class: 'block-title' }, '선생님 안내'), h('ul', null, [].concat(d.guide).map((x) => h('li', null, x)))) : null,
        d.ideas?.length ? h('div', { class: 'block' }, h('p', { class: 'block-title' }, '예시 생각 (정답이 아니에요)'), h('ul', null, d.ideas.map((x) => h('li', null, x)))) : null,
      );
      return;
    default:
      fill(liveEl,
        where(d),
        h('p', { class: 'wait' }, d.message || '딸깍 보결 화면에서 수업을 시작하면 정답이 여기에 떠요.'),
      );
  }
}

// 두 길(BroadcastChannel·postMessage, js/ui/live.js)로 같은 내용이 올 수 있어 같은 것은 한 번만 그린다
let lastKey = '';
function receive(d) {
  if (!d || typeof d !== 'object' || !d.kind || d.kind === 'hello') return;
  const key = JSON.stringify(d);
  if (key === lastKey) return;
  lastKey = key;
  render(d);
}

const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(LIVE_CHANNEL) : null;
if (bc) bc.onmessage = (e) => receive(e.data);
// 이 창을 연 수업 화면(window.opener)이 직접 보내는 길 — 단일 HTML 파일은 이 길만 된다
window.addEventListener('message', (e) => {
  if (e.source && e.source === window.opener) receive(e.data);
});
// 수업 도중에 열면 "지금 무엇이 나와 있나"를 물어본다
bc?.postMessage({ kind: 'hello' });
try {
  window.opener?.postMessage({ kind: 'hello' }, '*');
} catch {
  /* 연 창이 없으면 BroadcastChannel 로만 */
}
