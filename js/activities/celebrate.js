// ⑥ 별 축하·마무리: 반 전체 별 합계만 크게. 모둠 순위는 보여 주지 않는다.
import { h, fill } from '../ui/dom.js';
import { totalStars } from '../core/session.js';

export function mount(el, ctx) {
  const titles = ctx.state.plan.steps
    .filter((s) => s.kind !== 'greet' && s.kind !== 'celebrate')
    .map((s) => s.title);
  const numEl = h('strong', { class: 'cele-num' });

  function update() {
    const n = totalStars(ctx.state);
    numEl.textContent = String(n);
    numEl.setAttribute('data-celebrate-total', String(n));
  }

  fill(el,
    h('div', { class: 'celebrate' },
      h('div', { class: 'cele-icon', 'aria-hidden': 'true' }, '🎉'),
      h('h2', { class: 'cele-total' }, '오늘 우리 반 별 ', numEl, '개!'),
      h('p', { class: 'cele-sub' }, '모든 모둠이 함께 모은 별이에요. 정말 잘했어요!'),
      h('section', { class: 'cele-look' },
        h('h3', null, '🙋 가장 재미있었던 순서에 손을 들어요'),
        h('div', { class: 'cele-chips' }, titles.map((t) => h('span', { class: 'cele-chip' }, t))),
      ),
      h('div', { class: 'act-buttons' },
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'home', onClick: () => ctx.api.home() }, '처음 화면으로'),
      ),
    ),
  );
  update();
  return { tick() {}, destroy() {}, onStars: update };
}
