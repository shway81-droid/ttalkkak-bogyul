// 세트 진행 화면: 위쪽 띠 · 별판 · 규칙 안내 · 활동.
// 시계는 하나(setInterval 200ms + performance.now 차이). 멈춤 하나로 모든 시간이 함께 멈춘다.
import { h, fill, formatRemain } from './dom.js';
import { guard, settleGate } from './guard.js';
import * as S from '../core/session.js';
import { rulesFor } from '../core/rules.js';
import { ACTIVITIES, STEP_ICON } from '../activities/index.js';

const TICK_MS = 200;
// 차례가 있는 놀이에서만 별판의 차례 모둠을 강조한다.
const TURN_KINDS = new Set(['word', 'gesture']);

export function runSession(root, { plan, teamCount, sfx, onExit }) {
  const state = S.createSession(plan, teamCount);
  const lastIndex = plan.steps.length - 1;
  let activity = null;
  let overtimeNotified = false;
  let last = performance.now();
  let modal = null;

  // [다음 순서] 버튼과 → 키가 같은 막기를 쓴다(빠른 두 번 누름 → 한 칸만).
  const guardedNext = guard(nextStep);

  // ---- 위쪽 띠 --------------------------------------------------------------
  const pills = plan.steps.map((step, i) =>
    h('button', { class: 'pill', type: 'button', 'data-act': `goto-${i}`, 'data-step-kind': step.kind, title: `${step.title} ${step.minutes}분`, onClick: () => goTo(i) },
      h('span', { class: 'pill-no' }, String(i + 1)), ' ', step.title),
  );
  const timerEl = h('span', { class: 'timer', 'data-remain': '', 'aria-live': 'off' });
  const pauseBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'pause', onClick: togglePause });
  const muteBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'mute', onClick: toggleMute });
  const fsBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'fullscreen', title: '전체화면', 'aria-label': '전체화면', onClick: toggleFullscreen }, '⛶');
  const nextBtn = h('button', { class: 'next-btn', type: 'button', 'data-act': 'next-step', onClick: guardedNext }, '다음 순서 ▶');
  const exitBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'exit', title: '끝내기', 'aria-label': '끝내기', onClick: openExit }, '✕');
  const pausedBadge = h('div', { class: 'paused-badge', hidden: true }, '⏸ 잠깐 멈췄어요');

  // ---- 별판 -----------------------------------------------------------------
  const teamsEl = h('div', { class: 'teams' });
  const totalEl = h('span', { class: 'class-total', 'data-total': '0' });
  const undoBtn = h('button', { class: 'tool-btn', type: 'button', 'data-act': 'undo', title: '마지막 별 되돌리기', onClick: undo }, '↶ 되돌리기');

  const stage = h('div', { class: 'stage' });

  const shell = h('div', { class: 'session' },
    h('header', { class: 'strip' },
      h('span', { class: 'strip-title' }, plan.title),
      h('nav', { class: 'pills', 'aria-label': '순서' }, pills),
      timerEl, pauseBtn, muteBtn, fsBtn, nextBtn, exitBtn,
    ),
    h('section', { class: 'board', 'aria-label': '모둠 별판' }, teamsEl, h('div', { class: 'board-tools' }, totalEl, undoBtn)),
    h('div', { class: 'stage-wrap' }, stage, pausedBadge),
    h('footer', { class: 'credit credit-small' }, '문항·이야기·그림: 짬짬이'),
  );
  fill(root, shell);

  // ---- 활동에 넘기는 것 -------------------------------------------------------
  const api = {
    awardTurn() {
      const t = S.awardTurn(state);
      starsChanged();
      return t;
    },
    passTurn() {
      S.passTurn(state);
      starsChanged();
    },
    awardTeams(teams) {
      S.awardTeams(state, teams);
      starsChanged();
    },
    awardAll() {
      S.awardAll(state);
      starsChanged();
    },
    currentTurn: () => state.turn,
    home: () => finish(),
  };

  // ---- 그리기 ---------------------------------------------------------------
  function renderStrip() {
    pills.forEach((p, i) => {
      p.classList.toggle('on', i === state.stepIndex);
      p.classList.toggle('done', i < state.stepIndex);
      p.setAttribute('aria-current', i === state.stepIndex ? 'step' : 'false');
    });
    nextBtn.disabled = state.stepIndex >= lastIndex;
    pauseBtn.textContent = state.paused ? '▶' : '⏸';
    pauseBtn.setAttribute('aria-label', state.paused ? '다시 시작' : '잠깐 멈춤');
    pauseBtn.title = state.paused ? '다시 시작 (Space)' : '잠깐 멈춤 (Space)';
    pausedBadge.hidden = !state.paused;
    muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', sfx.muted ? '소리 켜기' : '소리 끄기');
    updateTimer();
  }

  function updateTimer() {
    timerEl.textContent = `⏱ ${formatRemain(state.remainMs)}`;
    const over = state.phase === 'active' && S.isOvertime(state);
    timerEl.classList.toggle('over', over);
    nextBtn.classList.toggle('blink', over && state.stepIndex < lastIndex);
    if (over && !overtimeNotified) {
      overtimeNotified = true;
      sfx.timeUp();
    }
  }

  function renderBoard() {
    const step = plan.steps[state.stepIndex];
    const showTurn = TURN_KINDS.has(step.kind);
    fill(teamsEl, state.stars.map((n, t) => {
      const isTurn = showTurn && t === state.turn;
      // 모둠 칩 자체가 [+] 버튼이다(좁은 화면에서도 모둠 이름이 잘리지 않게). [−]만 따로 둔다.
      return h('div', { class: `team${isTurn ? ' turn' : ''}`, 'data-team': String(t) },
        h('button', { class: 'team-add', type: 'button', 'data-act': `star-add-${t}`, title: `${t + 1}모둠 별 더하기`, 'aria-label': `${t + 1}모둠 별 더하기 (지금 ${n}개)`, onClick: () => { S.addStar(state, t); starsChanged(); } },
          h('span', { class: 'team-name' }, `${t + 1}모둠`),
          h('span', { class: 'team-stars' }, `★${n}`),
          h('span', { class: 'team-plus', 'aria-hidden': 'true' }, '+'),
        ),
        h('button', { class: 'mini', type: 'button', 'data-act': `star-remove-${t}`, title: `${t + 1}모둠 별 빼기`, 'aria-label': `${t + 1}모둠 별 빼기`, onClick: () => { S.removeStar(state, t); starsChanged(); } }, '−'),
      );
    }));
    const total = S.totalStars(state);
    totalEl.setAttribute('data-total', String(total));
    totalEl.textContent = `우리 반 ★${total}`;
    undoBtn.disabled = state.log.length === 0;
  }

  function starsChanged() {
    renderBoard();
    activity?.onStars?.();
  }

  function renderRules() {
    const step = plan.steps[state.stepIndex];
    const { lines, prep } = rulesFor(step.kind, plan.band);
    fill(stage,
      h('section', { class: 'rules', 'data-view': 'rules' },
        h('p', { class: 'rules-step' }, `${state.stepIndex + 1}번째 순서 · ${step.minutes}분`),
        h('h2', { class: 'rules-title' }, `${STEP_ICON[step.kind] || ''} ${step.title}`),
        h('ul', { class: 'rules-lines' }, lines.map((l) => h('li', null, l))),
        prep && h('p', { class: 'rules-prep' }, `🎒 ${prep}`),
        h('button', { class: 'btn btn-go btn-huge', type: 'button', 'data-act': 'start-step', onClick: guard(startStep) }, '▶ 시작'),
        h('p', { class: 'teacher-note' }, '선생님: 위 글을 읽어 주고 [▶ 시작]을 눌러 주세요'),
      ),
    );
  }

  function startStep() {
    if (state.phase !== 'rules') return;
    S.beginStep(state);
    const step = plan.steps[state.stepIndex];
    const host = h('section', { class: `act act-${step.kind}`, 'data-view': 'activity', 'data-kind': step.kind });
    fill(stage, host);
    const mod = ACTIVITIES[step.kind];
    // [▶ 시작]을 두 번 누르면 두 번째 누름이 활동의 버튼에 닿는다 → 처음 400ms 는 무시.
    const gate = settleGate();
    gate.mark();
    activity = mod.mount(host, {
      step,
      band: plan.band,
      teamCount,
      state,
      api,
      sfx,
      guard: (fn) => guard(fn),
      gate,
    });
    renderStrip();
  }

  // ---- 조작 -----------------------------------------------------------------
  function destroyActivity() {
    if (activity) {
      try {
        activity.destroy();
      } finally {
        activity = null;
      }
    }
  }

  function goTo(i) {
    if (i < 0 || i > lastIndex) return;
    destroyActivity();
    S.goToStep(state, i);
    overtimeNotified = false;
    renderStrip();
    renderBoard();
    renderRules();
  }

  function nextStep() {
    if (state.stepIndex >= lastIndex) return;
    goTo(state.stepIndex + 1);
  }

  function togglePause() {
    S.togglePause(state);
    renderStrip();
  }

  function toggleMute() {
    sfx.toggle();
    renderStrip();
  }

  function undo() {
    if (S.undo(state)) starsChanged();
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
    } catch {
      /* 전체화면이 안 되는 브라우저 */
    }
  }

  function openExit() {
    if (modal) return;
    modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '끝내기 확인' },
      h('div', { class: 'modal-box' },
        h('p', { class: 'modal-q' }, '처음 화면으로 돌아갈까요?'),
        h('p', { class: 'modal-sub' }, '지금까지 모은 별과 진행 순서는 사라져요.'),
        h('div', { class: 'modal-btns' },
          h('button', { class: 'btn btn-warn', type: 'button', 'data-act': 'exit-confirm', onClick: finish }, '네, 처음으로'),
          h('button', { class: 'btn', type: 'button', 'data-act': 'exit-cancel', onClick: closeExit }, '아니요, 계속해요'),
        ),
      ),
    );
    shell.append(modal);
  }

  function closeExit() {
    modal?.remove();
    modal = null;
  }

  function onKey(e) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    } else if (e.key === 'ArrowRight') {
      guardedNext();
    } else if (e.key === 'Escape' && modal) {
      closeExit();
    }
  }
  document.addEventListener('keydown', onKey);

  const interval = setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    S.tick(state, dt);
    if (activity && state.phase === 'active' && !state.paused) activity.tick(dt);
    updateTimer();
  }, TICK_MS);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(interval);
    document.removeEventListener('keydown', onKey);
    destroyActivity();
    onExit();
  }

  renderStrip();
  renderBoard();
  renderRules();

  return { state, finish };
}
