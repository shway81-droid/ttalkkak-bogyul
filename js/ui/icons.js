// 화면 아이콘은 모두 루시드(Lucide) SVG 를 쓴다(이모지 대신 — 기기마다 모양이 달라지지 않게).
// 아이콘 모양은 icon-paths.js(자동 생성)에 있고, 여기서는 <span class="ic"> 로 감싸 글자처럼 다룬다.
//   icon('play')                → 글자 크기(1em)를 따르는 선 아이콘
//   icon('star', { fill: true }) → 속을 채운 아이콘
//   withIcons('맞히면 ★')       → ★ 자리에 채운 별 아이콘을 넣은 조각 배열(h() 자식으로 그대로 씀)
import { ICON_PATHS } from './icon-paths.js';

export function icon(name, { fill = false, cls = '' } = {}) {
  const paths = ICON_PATHS[name];
  if (!paths) throw new Error(`아이콘 없음: ${name} (scripts/build-icons.mjs 의 NAMES 에 더하세요)`);
  const span = document.createElement('span');
  span.className = `ic ic-${name}${fill ? ' ic-fill' : ''}${cls ? ` ${cls}` : ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths}</svg>`;
  return span;
}

/** 별 아이콘 하나(속 채움) */
export const star = () => icon('star', { fill: true });

/** 글 속의 ★ 를 별 아이콘으로 바꾼 조각 배열 */
export function withIcons(text) {
  const parts = String(text).split('★');
  const out = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(star());
    if (p) out.push(p);
  });
  return out;
}
