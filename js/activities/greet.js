// ① 인사·모둠·약속: 패널 4장을 [다음]으로 넘긴다.
import { h, fill } from '../ui/dom.js';

function panels(ctx) {
  const lower = ctx.band === 'lower';
  return [
    {
      icon: '👋',
      title: '안녕하세요!',
      lines: [lower ? '오늘 함께할 선생님이에요' : '오늘 한 시간 동안 함께할 선생님이에요'],
      teacher: '칠판에 선생님 이름을 크게 써 주세요',
    },
    {
      icon: '👥',
      title: '모둠을 만들어요',
      lines: [lower ? '앉은 자리대로 모둠을 만들어요' : '지금 앉은 자리대로 모둠을 만들어요'],
      chips: true,
      teacher: '모둠 자리가 아니면 줄이나 분단으로 나눠 주세요',
    },
    {
      icon: '🤙',
      title: '오늘의 약속',
      lines: ['차례인 모둠만 답해요', '친구 말을 끝까지 들어요', '다 함께 즐겁게 참여해요'],
    },
    {
      icon: '⭐',
      title: '별 받는 법',
      lines: ['맞히면 ★', '발표해도 ★', '끝까지 함께하면 ★'],
      teacher: '모둠 별을 모두 모아 우리 반 별을 만들어요',
    },
  ];
}

export function mount(el, ctx) {
  const list = panels(ctx);
  let i = 0;

  function render() {
    const p = list[i];
    const isLast = i === list.length - 1;
    fill(el,
      h('div', { class: 'greet', 'data-panel': String(i) },
        h('p', { class: 'greet-dots', 'aria-label': `${i + 1} / ${list.length}` },
          list.map((_, k) => h('i', { class: k === i ? 'dot on' : 'dot' }))),
        h('div', { class: 'greet-icon', 'aria-hidden': 'true' }, p.icon),
        h('h2', { class: 'greet-title' }, p.title),
        h('ul', { class: 'greet-lines' }, p.lines.map((l) => h('li', null, l))),
        p.chips && h('div', { class: 'greet-teams' },
          Array.from({ length: ctx.teamCount }, (_, t) => h('span', { class: 'greet-team' }, `${t + 1}모둠`))),
        p.teacher && h('p', { class: 'teacher-note' }, `선생님: ${p.teacher}`),
        h('div', { class: 'act-buttons' },
          isLast
            ? h('p', { class: 'teacher-note' }, '준비가 끝나면 위쪽 [다음 순서 ▶]를 눌러 주세요')
            : h('button', { class: 'btn btn-go btn-big', type: 'button', 'data-act': 'greet-next', onClick: next }, '다음 ▶'),
        ),
      ),
    );
  }

  const next = ctx.guard(() => {
    if (i < list.length - 1) {
      i += 1;
      render();
    }
  });

  render();
  return { tick() {}, destroy() {} };
}
