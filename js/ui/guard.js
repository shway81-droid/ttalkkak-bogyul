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
