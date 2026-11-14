// 마지막 순서, 별 축하·마무리: 반 전체 별 합계만 크게. 모둠 순위는 보여 주지 않는다.
// 들어오면 별 숫자가 0부터 세어 올라가고, 다 세면 축하 소리와 꽃가루. 우리 반 별 목표도 함께 알린다.
import { h, fill } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { totalStars } from '../core/session.js';
import { countUp, confetti } from '../ui/fx.js';

export function mount(el, ctx) {
  const titles = ctx.state.plan.steps
    .filter((s) => s.kind !== 'greet' && s.kind !== 'celebrate')
    .map((s) => s.title);
  const goal = ctx.api.goal;
  const numEl = h('strong', { class: 'cele-num' });
  const goalEl = h('p', { class: 'cele-goal' });
  let counting = true;

  function goalLine(n) {
    return n >= goal ? `우리 반 별 목표 ${goal}개를 이뤘어요!` : `목표 ${goal}개까지 ${goal - n}개! 다음에는 꼭 넘어 봐요`;
  }

  function update() {
    const n = totalStars(ctx.state);
    numEl.setAttribute('data-celebrate-total', String(n));
    if (goal) {
      goalEl.replaceChildren(icon(n >= goal ? 'trophy' : 'goal'), ` ${goalLine(n)}`);
      goalEl.classList.toggle('done', n >= goal);
    }
    if (!counting) numEl.textContent = String(n);
  }

  fill(el,
    h('div', { class: 'celebrate' },
      h('div', { class: 'cele-icon', 'aria-hidden': 'true' }, icon('party-popper')),
      h('h2', { class: 'cele-total' }, '오늘 우리 반 별 ', numEl, '개!'),
      goal ? goalEl : null,
      h('p', { class: 'cele-sub' }, '모든 모둠이 함께 모은 별이에요. 정말 잘했어요!'),
      h('section', { class: 'cele-look' },
        h('h3', null, icon('hand'), ' 가장 재미있었던 순서에 손을 들어요'),
        h('div', { class: 'cele-chips' }, titles.map((t) => h('span', { class: 'cele-chip' }, t))),
      ),
      h('div', { class: 'act-buttons' },
        h('button', { class: 'btn btn-big', type: 'button', 'data-act': 'home', onClick: () => ctx.api.home() }, '처음 화면으로'),
      ),
    ),
  );
  update();
  // 0 부터 세어 올라가고, 다 세면 축하 소리와 꽃가루
  const stop = countUp(numEl, totalStars(ctx.state), {
    onDone: () => {
      counting = false;
      update();
      ctx.sfx.fanfare?.();
      confetti(120);
    },
  });
  ctx.api.live?.({ kind: 'idle', message: '별 축하·마무리 중이에요' });
  return { tick() {}, destroy() { stop(); }, onStars: update };
}
