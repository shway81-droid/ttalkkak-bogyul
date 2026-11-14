// 움직임 효과: 별이 별판으로 날아가기, 꽃가루, 숫자 세어 올라가기.
// 모두 Web Animations API 로 짧게 움직이고 스스로 지운다. '동작 줄이기' 설정이면 움직이지 않는다.
import { star } from './icons.js';

const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 화면 가운데(from 요소의 가운데)에서 to 요소로 별 하나가 날아간다 */
export function flyStar(fromEl, toEl, delay = 0) {
  if (reduced() || !fromEl || !toEl?.isConnected) return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const s = star();
  s.classList.add('fx-star');
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x0;
  const dy = b.top + b.height / 2 - y0;
  Object.assign(s.style, { left: `${x0}px`, top: `${y0}px` });
  document.body.append(s);
  const anim = s.animate([
    { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(2.2)', opacity: 1, offset: 0.25 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.8)`, opacity: 1 },
  ], { duration: 750, delay, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' });
  anim.onfinish = () => {
    s.remove();
    bump(toEl);
  };
}

/** 살짝 튀어 오르기(별을 받은 모둠 칩 등) */
export function bump(el) {
  if (reduced() || !el?.isConnected) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
}

const COLORS = ['#ffb703', '#e4576e', '#12a57c', '#4fa8e8', '#7a5fd0', '#f08a40'];

/** 화면 위에서 꽃가루가 흩날린다 */
export function confetti(count = 90) {
  if (reduced()) return;
  const w = innerWidth;
  const h = innerHeight;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'fx-confetti';
    p.setAttribute('aria-hidden', 'true');
    const size = 8 + Math.random() * 10;
    Object.assign(p.style, {
      left: `${Math.random() * w}px`,
      width: `${size}px`,
      height: `${size * (0.4 + Math.random() * 0.6)}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: Math.random() < 0.3 ? '50%' : '2px',
    });
    document.body.append(p);
    const drift = (Math.random() - 0.5) * 240;
    const spin = (Math.random() - 0.5) * 1080;
    const anim = p.animate([
      { transform: 'translate(0, -20px) rotate(0deg)', opacity: 1 },
      { transform: `translate(${drift}px, ${h + 40}px) rotate(${spin}deg)`, opacity: 0.9 },
    ], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
    anim.onfinish = () => p.remove();
  }
}

/** 0 에서 n 까지 숫자가 세어 올라간다(끝나면 onDone) */
export function countUp(el, n, { duration = 1400, onDone } = {}) {
  if (reduced() || n <= 0) {
    el.textContent = String(n);
    onDone?.();
    return () => {};
  }
  const t0 = performance.now();
  let raf = 0;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / duration);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = String(Math.round(n * eased));
    if (k < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
