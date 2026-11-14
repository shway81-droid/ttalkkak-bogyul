// 선생님용 실시간 정답 창(answer.html)과 이어지는 곳 — 짬짬이 낱말의 '실시간 정답 창'과 같은 방식.
// 수업 화면(칠판)이 BroadcastChannel 로 지금 문제를 알리면 정답 창이 정답을 띄운다.
// 같은 브라우저의 두 창끼리만 통하고 서버가 없다(인터넷이 끊겨도 된다).
// 칠판을 '복제' 화면으로 쓰면 아이들에게도 보이므로 정답 창은 노트북 화면(확장 화면)에 둔다.

export const LIVE_CHANNEL = 'ttalkkak-bogyul:live';

/** 정답 창을 새 창으로 연다(이미 열려 있으면 그 창을 앞으로) */
export function openAnswerWindow() {
  const w = window.open('answer.html', 'ttalkkak-bogyul-answer', 'popup,width=560,height=860');
  w?.focus?.();
}
