// 두 번 눌림 막기: 마지막 실행 뒤 ms 안에 다시 불리면 무시한다.
const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function guard(fn, ms = 400, now = defaultNow) {
  let last = -Infinity;
  return function guarded(...args) {
    const t = now();
    if (t - last < ms) return undefined;
    last = t;
    return fn.apply(this, args);
  };
}

/**
 * 버튼이 같은 자리에서 다른 버튼으로 바뀔 때, 두 번 누름의 두 번째가 새 버튼에 닿지 않게 한다.
 * 화면을 바꿀 때 mark(), 새 버튼을 누를 때 ready() 가 참일 때만 처리한다.
 */
export function settleGate(ms = 400, now = defaultNow) {
  let at = -Infinity;
  return {
    mark() {
      at = now();
    },
    ready() {
      return now() - at >= ms;
    },
  };
}
