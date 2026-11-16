// 이야기 나누기(7분): 읽기 → 혼자 생각 → 나누기 → 발표 → 생각 넓히기.
// 단계 시간은 tick 으로만 줄고, 0이 되면 [다음 단계]가 천천히 빛난다(저절로 넘어가지 않음).
import { h, fill } from '../ui/dom.js';
import { icon, star, withIcons } from '../ui/icons.js';
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

  // 켜고 끄는 버튼이라 두 번 누르면 켜졌다 바로 꺼진다 → 막는다
  const onHintToggle = ctx.guard(() => {
    showHint = !showHint;
    render();
  });
  const onIdeasToggle = ctx.guard(() => {
    showIdeas = !showIdeas;
    render();
  });

  function readSize(input) {
    // 칸을 비우거나 숫자가 아니면 앞 값을 그대로 쓴다
    if (!String(input.value).trim()) return classSize;
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
    sizeText = String(classSize); // 비웠거나 범위 밖이던 칸에 실제로 쓴 인원을 다시 보여 준다
    render();
  });

  function stageBody() {
    const key = STORY_STAGES[stage][0];
    const q = h('p', { class: 'story-q' }, icon('circle-help'), ` ${story.mainQuestion}`);
    if (key === 'STORY') {
      return [
        h('h2', { class: 'story-title' }, story.title),
        h('div', { class: `story-text${story.story.join('').length > 160 ? ' long' : ''}` },
          story.story.map((line) => h('p', { 'data-sentence': '' }, line))),
      ];
    }
    if (key === 'THINK') return [q, h('p', { class: 'story-sub' }, icon('mic-off'), ' 혼자 조용히 내 생각을 정해요')];
    if (key === 'TALK') return [q, h('p', { class: 'story-sub' }, icon('messages-square'), ' 짝·모둠과 이야기 나눠요')];
    if (key === 'PRESENT') {
      return [
        h('p', { class: 'story-q small' }, icon('circle-help'), ` ${story.mainQuestion}`),
        h('div', { class: 'picker' },
          h('label', { class: 'picker-size' }, '반 인원 ',
            h('input', {
              type: 'number', min: String(CLASS_SIZE.min), max: String(CLASS_SIZE.max), value: sizeText,
              'data-field': 'class-size', inputmode: 'numeric', 'aria-label': '반 인원',
              onInput: (e) => { sizeText = e.target.value; },
            }), '명'),
          h('button', { class: 'btn btn-big btn-go', type: 'button', 'data-act': 'pick-number', onClick: onPick }, icon('dices'), ' 번호 뽑기'),
          h('span', { class: 'picker-num', 'data-picked': picked === null ? '' : String(picked), 'aria-live': 'polite' },
            picked === null ? '?' : `${picked}번`),
        ),
        h('p', { class: 'story-sub' }, withIcons('발표한 모둠은 별판에서 ★를 눌러 주세요')),
      ];
    }
    return [
      h('p', { class: 'story-sub' }, icon('sprout'), ' 생각을 넓혀요'),
      h('ul', { class: 'story-follow' }, (story.followUpQuestions || []).map((f) => h('li', null, f))),
    ];
  }

  function extras() {
    const out = [];
    if (showHint && story.hint) out.push(h('p', { class: 'story-hint' }, icon('lightbulb'), ` ${story.hint}`));
    if (showIdeas && story.sampleIdeas?.length) {
      out.push(h('div', { class: 'story-ideas' },
        h('p', { class: 'story-ideas-note' }, icon('sprout'), ' 예시 생각 (정답이 아니에요)'),
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
    nextBtn = h('button', { class: 'btn btn-go', type: 'button', 'data-act': 'stage-next', disabled: isLast, onClick: onNext }, '다음 단계 ', icon('chevron-right'));
    fill(el,
      h('div', { class: 'story' },
        h('ol', { class: 'stages', 'aria-label': '이야기 단계' },
          STORY_STAGES.map(([, name], i) => h('li', { class: i === stage ? 'on' : i < stage ? 'done' : '' }, name))),
        h('div', { class: 'who', 'data-stage': label }, `${label} · `, timerSpan),
        h('div', { class: `story-body${STORY_STAGES[stage][0] === 'STORY' ? ' story-read' : ''}` }, stageBody(), extras()),
      ),
      h('div', { class: 'act-buttons' },
        h('button', { class: 'btn', type: 'button', 'data-act': 'stage-prev', disabled: stage === 0, onClick: onPrev }, icon('chevron-left'), ' 이전 단계'),
        story.hint ? h('button', { class: 'btn', type: 'button', 'data-act': 'hint', 'aria-pressed': String(showHint), onClick: onHintToggle }, icon('lightbulb'), ' 힌트') : null,
        story.sampleIdeas?.length ? h('button', { class: 'btn', type: 'button', 'data-act': 'ideas', 'aria-pressed': String(showIdeas), onClick: onIdeasToggle }, icon('sprout'), ' 예시 생각') : null,
        h('button', { class: 'btn btn-ok', type: 'button', 'data-act': 'award-all', onClick: onAwardAll }, '모두 ', star()),
        nextBtn,
      ),
    );
    updateTimer();
    fitStory();
    ctx.api.live?.({
      kind: 'story',
      label: `이야기 나누기 · ${STORY_STAGES[stage][1]}`,
      prompt: story.title,
      answer: story.mainQuestion,
      list: story.followUpQuestions,
      guide: story.teacherGuide,
      ideas: story.sampleIdeas,
    });
  }

  // 이야기 읽기 단계: 본문을 남은 자리에 들어가는 가장 큰 글자로(뒷자리에서도 읽히게).
  // 이야기마다 길이가 2~6문장으로 달라 고정 크기로는 짧은 이야기가 작고 긴 이야기는 넘친다.
  function fitStory() {
    const body = el.querySelector('.story-read');
    if (!body) return;
    const fits = () => body.scrollHeight <= body.clientHeight + 1 && body.scrollWidth <= body.clientWidth + 1;
    const vh = window.innerHeight / 100;
    const vw = window.innerWidth / 100;
    let lo = 16;
    let hi = Math.max(lo, Math.min(8 * vh, 4.2 * vw));
    body.style.fontSize = `${hi}px`;
    if (fits()) return;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      body.style.fontSize = `${mid}px`;
      if (fits()) lo = mid;
      else hi = mid;
    }
    body.style.fontSize = `${lo}px`;
  }

  const onResize = () => fitStory();
  window.addEventListener('resize', onResize);
  document.fonts?.ready.then(() => fitStory());

  render();

  return {
    tick(dt) {
      if (remainMs <= 0) return;
      remainMs -= dt;
      updateTimer();
    },
    destroy() {
      window.removeEventListener('resize', onResize);
    },
  };
}
