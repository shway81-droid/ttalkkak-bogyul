// 이야기 나누기(7분): 읽기 → 혼자 생각 → 나누기 → 발표 → 생각 넓히기.
// 단계 시간은 tick 으로만 줄고, 0이 되면 [다음 단계]가 천천히 빛난다(저절로 넘어가지 않음).
import { h, fill } from '../ui/dom.js';
import { makeRng, shuffle } from '../core/rng.js';

export const STORY_STAGES = [
  ['STORY', '이야기 읽기', 60],
  ['THINK', '혼자 생각하기', 30],
  ['TALK', '이야기 나누기', 90],
  ['PRESENT', '발표하기', 120],
  ['EXTEND', '생각 넓히기', 90],
];

export const CLASS_SIZE = { def: 25, min: 2, max: 40 };

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function mount(el, ctx) {
  const { story } = ctx.step.content;
  const rng = makeRng(Math.floor(Math.random() * 4294967296));
  let stage = 0;
  let remainMs = STORY_STAGES[0][2] * 1000;
  let showHint = false;
  let showIdeas = false;
  // 발표자 뽑기(이름 없이 번호만, 저장하지 않음)
  let classSize = CLASS_SIZE.def;
  let sizeText = String(CLASS_SIZE.def); // 입력 칸에 적힌 그대로(다시 그려도 유지)
  let pool = [];
  let picked = null;
  // 시계는 화면 전체를 다시 그리지 않고 이 두 곳만 고친다(입력 중인 칸을 지키려고).
  let timerSpan = null;
  let nextBtn = null;

  function setStage(i) {
    stage = Math.max(0, Math.min(STORY_STAGES.length - 1, i));
    remainMs = STORY_STAGES[stage][2] * 1000;
    showHint = false;
    showIdeas = false;
    ctx.gate.mark();
    render();
  }

  const onPrev = ctx.guard(() => {
    if (!ctx.gate.ready() || stage === 0) return;
    setStage(stage - 1);
  });
  const onNext = ctx.guard(() => {
    if (!ctx.gate.ready() || stage === STORY_STAGES.length - 1) return;
    setStage(stage + 1);
  });
  const onAwardAll = ctx.guard(() => {
    if (!ctx.gate.ready()) return;
    ctx.api.awardAll();
    ctx.sfx.correct();
  });

  function readSize(input) {
    const n = Math.round(Number(input.value));
    if (!Number.isFinite(n)) return classSize;
    return Math.max(CLASS_SIZE.min, Math.min(CLASS_SIZE.max, n));
  }

  const onPick = ctx.guard(() => {
    const input = el.querySelector('[data-field="class-size"]');
    const size = input ? readSize(input) : classSize;
    if (size !== classSize) {
      classSize = size;
      pool = [];
    }
    if (pool.length === 0) {
      pool = shuffle(Array.from({ length: classSize }, (_, i) => i + 1), rng);
      // 다시 섞은 첫 번호가 바로 앞 번호와 같지 않게
      if (pool.length > 1 && pool[pool.length - 1] === picked) [pool[0], pool[pool.length - 1]] = [pool[pool.length - 1], pool[0]];
    }
    picked = pool.pop();
    render();
  });

  function stageBody() {
    const key = STORY_STAGES[stage][0];
    const q = h('p', { class: 'story-q' }, `❓ ${story.mainQuestion}`);
    if (key === 'STORY') {
      return [
        h('h2', { class: 'story-title' }, story.title),
        h('div', { class: `story-text${story.story.join('').length > 160 ? ' long' : ''}` },
          story.story.map((line) => h('p', { 'data-sentence': '' }, line))),
      ];
    }
    if (key === 'THINK') return [q, h('p', { class: 'story-sub' }, '🤫 혼자 조용히 내 생각을 정해요')];
    if (key === 'TALK') return [q, h('p', { class: 'story-sub' }, '🗣 짝·모둠과 이야기 나눠요')];
    if (key === 'PRESENT') {
      return [
        h('p', { class: 'story-q small' }, `❓ ${story.mainQuestion}`),
        h('div', { class: 'picker' },
          h('label', { class: 'picker-size' }, '반 인원 ',
            h('input', {
              type: 'number', min: String(CLASS_SIZE.min), max: String(CLASS_SIZE.max), value: sizeText,
              'data-field': 'class-size', inputmode: 'numeric', 'aria-label': '반 인원',
              onInput: (e) => { sizeText = e.target.value; },
            }), '명'),
          h('button', { class: 'btn btn-big btn-go', type: 'button', 'data-act': 'pick-number', onClick: onPick }, '🎲 번호 뽑기'),
          h('span', { class: 'picker-num', 'data-picked': picked === null ? '' : String(picked), 'aria-live': 'polite' },
            picked === null ? '?' : `${picked}번`),
        ),
        h('p', { class: 'story-sub' }, '발표한 모둠은 별판에서 ★를 눌러 주세요'),
      ];
    }
    return [
      h('p', { class: 'story-sub' }, '🌱 생각을 넓혀요'),
      h('ul', { class: 'story-follow' }, (story.followUpQuestions || []).map((f) => h('li', null, f))),
    ];
  }

  function extras() {
    const out = [];
    if (showHint && story.hint) out.push(h('p', { class: 'story-hint' }, `💡 ${story.hint}`));
    if (showIdeas && story.sampleIdeas?.length) {
      out.push(h('div', { class: 'story-ideas' },
        h('p', { class: 'story-ideas-note' }, '🌱 예시 생각 (정답이 아니에요)'),
        h('ul', null, story.sampleIdeas.map((s) => h('li', null, s)))));
    }
    return out;
  }

  function updateTimer() {
    const over = remainMs <= 0;
    timerSpan.textContent = over ? '시간 끝!' : fmt(remainMs);
    timerSpan.setAttribute('data-left', String(Math.ceil(Math.max(0, remainMs) / 1000)));
    nextBtn.classList.toggle('blink', over && stage < STORY_STAGES.length - 1);
  }

  function render() {
    const [, label] = STORY_STAGES[stage];
    const isLast = stage === STORY_STAGES.length - 1;
    timerSpan = h('span');
    nextBtn = h('button', { class: 'btn btn-go', type: 'button', 'data-act': 'stage-next', disabled: isLast, onClick: onNext }, '다음 단계 ▶');
    fill(el,
      h('div', { class: 'story' },
        h('ol', { class: 'stages', 'aria-label': '이야기 단계' },
          STORY_STAGES.map(([, name], i) => h('li', { class: i === stage ? 'on' : i < stage ? 'done' : '' }, name))),
        h('div', { class: 'who', 'data-stage': label }, `${label} · `, timerSpan),
        h('div', { class: 'story-body' }, stageBody(), extras()),
      ),
      h('div', { class: 'act-buttons' },
        h('button', { class: 'btn', type: 'button', 'data-act': 'stage-prev', disabled: stage === 0, onClick: onPrev }, '◀ 이전 단계'),
        story.hint ? h('button', { class: 'btn', type: 'button', 'data-act': 'hint', 'aria-pressed': String(showHint), onClick: () => { showHint = !showHint; render(); } }, '💡 힌트') : null,
        story.sampleIdeas?.length ? h('button', { class: 'btn', type: 'button', 'data-act': 'ideas', 'aria-pressed': String(showIdeas), onClick: () => { showIdeas = !showIdeas; render(); } }, '🌱 예시 생각') : null,
        h('button', { class: 'btn btn-ok', type: 'button', 'data-act': 'award-all', onClick: onAwardAll }, '모두 ★'),
        nextBtn,
      ),
    );
    updateTimer();
  }

  render();

  return {
    tick(dt) {
      if (remainMs <= 0) return;
      remainMs -= dt;
      updateTimer();
    },
    destroy() {},
  };
}
