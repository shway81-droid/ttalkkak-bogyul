// DOM 만들기는 h() 하나로 통일한다.
//   h('button', { class: 'btn', 'data-act': 'start', onClick: fn, disabled: true }, '▶ 시작')
// props 의 on<Event> 는 이벤트 처리기, class·style·그 밖의 이름은 속성으로 단다.
// false·null·undefined 인 속성과 자식은 건너뛴다.

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'g', 'rect', 'circle', 'line', 'polyline', 'text']);

export function h(tag, props, ...children) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k === 'text') {
      el.textContent = v;
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === false || c === null || c === undefined) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** 자식을 모두 지우고 새로 넣는다 */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

/** 남은 시간(ms) → "m:ss", 넘치면 "+m:ss" */
export function formatRemain(ms) {
  const over = ms < 0;
  const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${over ? '+' : ''}${m}:${s}`;
}
