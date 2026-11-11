// 따라 그리기 단계 시간 계산.
// 짬짬이 그리기(draw/js/app.js prepare())와 같은 공식이다.
// 경로는 절대 좌표 M·C 명령만 쓴다고 가정한다(자료 전수 확인).

export const SEC_BASE = 8;
export const SEC_PER_LENGTH = 12;
export const SEC_PER_EXTRA_STROKE = 2;
export const SEC_RANGE = [10, 30];

const SAMPLES = 32;

function cubicLength(p0, p1, p2, p3) {
  let len = 0;
  let px = p0[0];
  let py = p0[1];
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

/** 경로 문자열(M·C)의 길이 */
export function pathLength(d) {
  const tokens = d.match(/[MC]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  let i = 0;
  let cur = [0, 0];
  let cmd = null;
  let len = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'M' || t === 'C' || t === 'm' || t === 'c') {
      cmd = t.toUpperCase();
      i++;
      continue;
    }
    if (cmd === 'M') {
      cur = [num(), num()];
      cmd = 'C'; // M 다음에 이어지는 좌표는 쓰지 않지만, 안전하게 C로 본다
    } else if (cmd === 'C') {
      const p1 = [num(), num()];
      const p2 = [num(), num()];
      const p3 = [num(), num()];
      len += cubicLength(cur, p1, p2, p3);
      cur = p3;
    } else {
      i++;
    }
  }
  return len;
}

function diagonalOf(viewBox) {
  const [, , w, h] = String(viewBox).trim().split(/[\s,]+/).map(Number);
  return Math.hypot(w, h);
}

/** 한 단계(획 여러 개)의 시간(초) */
export function stepSeconds(step, viewBox) {
  if (typeof step.seconds === 'number') return step.seconds;
  const len = step.d.reduce((sum, d) => sum + pathLength(d), 0);
  const raw = SEC_BASE + SEC_PER_LENGTH * (len / diagonalOf(viewBox)) + SEC_PER_EXTRA_STROKE * (step.d.length - 1);
  const [lo, hi] = SEC_RANGE;
  return Math.round(Math.min(hi, Math.max(lo, raw)));
}

/** 그림 전체의 단계별 시간과 합 */
export function drawingTiming(drawing) {
  const sec = drawing.steps.map((s) => stepSeconds(s, drawing.viewBox));
  return { sec, totalSec: sec.reduce((a, b) => a + b, 0) };
}

/** 그리기+색칠 뒤에 꾸미기 시간이 minDecorateSec 이상 남는가 */
export function fitsSlot(drawing, slotSec = 480, minDecorateSec = 60) {
  const total = typeof drawing.totalSec === 'number' ? drawing.totalSec : drawingTiming(drawing).totalSec;
  return total + (drawing.coloringSeconds || 0) <= slotSec - minDecorateSec;
}
