// 따라 그리기(8분): 준비 → 단계별 따라 그리기 → 색칠 → 꾸미기.
// 단계는 시간이 다 되면 저절로 넘어간다(이 활동 안의 자동 진행은 설계 5.5가 허용).
// 시계는 화면 전체를 다시 그리지 않는다(선 그리기 움직임이 처음부터 다시 시작되지 않게).
import { h, fill } from '../ui/dom.js';
import { pathLength } from '../core/drawing.js';

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function diagonal(viewBox) {
  const [, , w, hgt] = viewBox.split(/[\s,]+/).map(Number);
  return Math.hypot(w, hgt);
}

export function mount(el, ctx) {
  const { drawing, decorate } = ctx.step.content;
  const n = drawing.steps.length;
  const sec = drawing.sec || drawing.steps.map(() => 15);
  const diag = diagonal(drawing.viewBox);
  const strokeW = Math.max(2, diag / 160);
  let mode = 'setup'; // setup | steps | coloring | decorate
  let k = 0;
  let remainMs = 0;
  let timerSpan = null;

  function svg(upto, highlight) {
    const paths = [];
    drawing.steps.forEach((st, i) => {
      if (i > upto) return;
      const isNew = highlight && i === upto;
      for (const d of st.d) {
        if (isNew) {
          const len = pathLength(d);
          const dur = Math.round(500 + 1100 * Math.min(1, len / diag));
          paths.push(h('path', {
            d, class: 'draw-new', pathLength: '1',
            style: { animationDuration: `${dur}ms`, strokeWidth: String(strokeW * 1.6) },
          }));
        } else {
          paths.push(h('path', { d, class: highlight ? 'draw-old' : 'draw-done', style: { strokeWidth: String(strokeW) } }));
        }
      }
    });
    return h('svg', { class: 'draw-svg', viewBox: drawing.viewBox, role: 'img', 'aria-label': `${drawing.title} 그림` }, paths);
  }

  function toMode(next) {
    mode = next;
    ctx.gate.mark();
    render();
  }

  const onStart = ctx.guard(() => {
    if (mode !== 'setup' || !ctx.gate.ready()) return;
    k = 0;
    remainMs = sec[0] * 1000;
    toMode('steps');
  });

  function goStep(i) {
    if (i >= n) {
      remainMs = drawing.coloringSeconds * 1000;
      toMode('coloring');
      return;
    }
    k = Math.max(0, i);
    remainMs = sec[k] * 1000;
    render();
  }

  const onPrev = ctx.guard(() => {
    if (mode !== 'steps' || !ctx.gate.ready() || k === 0) return;
    goStep(k - 1);
  });
  const onNext = ctx.guard(() => {
    if (mode !== 'steps' || !ctx.gate.ready()) return;
    goStep(k + 1);
  });
  const onAwardAll = ctx.guard(() => {
    if (!ctx.gate.ready()) return;
    ctx.api.awardAll();
    ctx.sfx.correct();
  });

  const awardBtn = () => h('button', { class: 'btn btn-ok', type: 'button', 'data-act': 'award-all', onClick: onAwardAll }, '모두 ★');

  function updateTimer() {
    if (timerSpan) timerSpan.textContent = fmt(remainMs);
  }

  function render() {
    timerSpan = h('span', { class: 'draw-timer' });
    if (mode === 'setup') {
      fill(el,
        h('div', { class: 'draw draw-setup' },
          h('h2', { class: 'draw-title' }, `✏️ ${drawing.title}`),
          h('div', { class: `paper paper-${drawing.paper}`, 'aria-hidden': 'true' }),
          h('p', { class: 'draw-say', 'data-setup': '' }, drawing.setupSay || '종이와 연필을 준비해요'),
          h('p', { class: 'teacher-note' }, `${n}단계로 그려요. 단계마다 새로 생기는 선을 따라 그려요.`),
        ),
        h('div', { class: 'act-buttons' },
          h('button', { class: 'btn btn-huge btn-go', type: 'button', 'data-act': 'draw-start', onClick: onStart }, '▶ 그리기 시작'),
        ),
      );
      return;
    }
    if (mode === 'steps') {
      const st = drawing.steps[k];
      fill(el,
        h('div', { class: 'draw draw-steps' },
          h('div', { class: 'draw-canvas' }, svg(k, true)),
          h('div', { class: 'draw-side' },
            h('p', { class: 'draw-count', 'data-draw-step': String(k + 1), 'data-total-steps': String(n) }, `${k + 1} / ${n}`),
            h('h2', { class: 'draw-label' }, st.label),
            h('p', { class: 'draw-say' }, st.teacherSay),
            h('p', { class: 'draw-time' }, '⏱ ', timerSpan),
          ),
        ),
        h('div', { class: 'act-buttons' },
          h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'draw-prev', disabled: k === 0, onClick: onPrev }, '◀ 이전'),
          h('button', { class: 'btn btn-big btn-go', type: 'button', 'data-act': 'draw-next', onClick: onNext }, k === n - 1 ? '색칠하기 ▶' : '다음 ▶'),
          awardBtn(),
        ),
      );
      updateTimer();
      return;
    }
    if (mode === 'coloring') {
      fill(el,
        h('div', { class: 'draw draw-steps' },
          h('div', { class: 'draw-canvas' }, svg(n - 1, false)),
          h('div', { class: 'draw-side', 'data-coloring': String(drawing.coloringSeconds) },
            h('h2', { class: 'draw-label' }, '🖍 색칠해요'),
            h('p', { class: 'draw-say' }, '다 그렸어요! 마음에 드는 색으로 칠해요.'),
            h('p', { class: 'draw-time' }, '⏱ ', timerSpan),
          ),
        ),
        h('div', { class: 'act-buttons' }, awardBtn()),
      );
      updateTimer();
      return;
    }
    fill(el,
      h('div', { class: 'draw draw-steps' },
        h('div', { class: 'draw-canvas small' }, svg(n - 1, false)),
        h('div', { class: 'draw-side' },
          h('h2', { class: 'draw-label' }, '🌈 나만의 꾸미기'),
          h('p', { class: 'draw-decorate', 'data-decorate': '' }, decorate || `${drawing.title} 둘레를 마음껏 꾸며요`),
          h('p', { class: 'teacher-note' }, '다 꾸민 친구는 짝에게 그림을 소개해요'),
        ),
      ),
      h('div', { class: 'act-buttons' }, awardBtn()),
    );
  }

  render();

  return {
    tick(dt) {
      if (mode === 'steps') {
        remainMs -= dt;
        // 큰 dt(배경 탭 등)에도 단계가 밀리지 않게 넘친 시간을 다음 단계로 넘긴다.
        while (mode === 'steps' && remainMs <= 0) {
          const carry = remainMs;
          goStep(k + 1);
          remainMs += carry; // 다음 단계(또는 색칠) 시간에서 넘친 만큼 뺀다
        }
        updateTimer();
      } else if (mode === 'coloring') {
        remainMs -= dt;
        if (remainMs <= 0) toMode('decorate');
        else updateTimer();
      }
    },
    destroy() {},
  };
}
