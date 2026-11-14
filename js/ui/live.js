// 선생님용 실시간 정답 창(answer.html)과 이어지는 곳 — 짬짬이 낱말의 '실시간 정답 창'과 같은 방식.
// 수업 화면(칠판)이 지금 문제를 알리면 정답 창이 정답을 띄운다. 서버가 없다(인터넷이 끊겨도 된다).
// 두 길로 함께 보낸다:
//   ① BroadcastChannel — 같은 브라우저의 같은 사이트 창끼리(정답 창을 따로 열어도 된다)
//   ② postMessage      — 이 화면이 연 정답 창으로 직접. 단일 HTML 파일(file://)에서는 ①이 안 되므로 이 길로 간다
// 정답 창은 같은 내용을 두 번 받으면 한 번만 그린다.
// 칠판을 '복제' 화면으로 쓰면 아이들에게도 보이므로 정답 창은 노트북 화면(확장 화면)에 둔다.
import { pageUrl } from './pages.js';

export const LIVE_CHANNEL = 'ttalkkak-bogyul:live';

// 이 화면이 연(또는 hello 를 보내 온) 정답 창
let answerWin = null;

/** 정답 창을 새 창으로 연다(이미 열려 있으면 그 창을 앞으로) */
export function openAnswerWindow() {
  const w = window.open(pageUrl('answer'), 'ttalkkak-bogyul-answer', 'popup,width=560,height=860');
  if (w) answerWin = w;
  w?.focus?.();
}

/**
 * 수업 화면 쪽 보내는 이. getLast() 는 정답 창이 처음 열려 hello 를 보내면 다시 보낼 마지막 내용.
 * 돌려주는 send(data) 로 보내고, close() 로 정리한다.
 */
export function createLiveSender(getLast) {
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(LIVE_CHANNEL) : null;
  const send = (data) => {
    try {
      bc?.postMessage(data);
    } catch {
      /* 창이 없어도 수업은 계속된다 */
    }
    try {
      if (answerWin && !answerWin.closed) answerWin.postMessage(data, '*');
    } catch {
      answerWin = null;
    }
  };
  if (bc) bc.onmessage = (e) => { if (e.data?.kind === 'hello') send(getLast()); };
  const onWindowMessage = (e) => {
    if (e.data?.kind !== 'hello' || !e.source) return;
    answerWin = e.source;
    send(getLast());
  };
  window.addEventListener('message', onWindowMessage);
  return {
    send,
    close() {
      window.removeEventListener('message', onWindowMessage);
      bc?.close();
    },
  };
}
