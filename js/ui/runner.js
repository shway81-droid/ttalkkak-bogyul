// 세트 진행 화면: 위쪽 띠 · 별판 · 규칙 안내 · 활동.
// 시계는 하나(setInterval 200ms + performance.now 차이). 멈춤 하나로 모든 시간이 함께 멈춘다.
import { h, fill, formatRemain } from './dom.js';
import { guard, settleGate } from './guard.js';
import * as S from '../core/session.js';
import { rulesFor } from '../core/rules.js';
import { ACTIVITIES, STEP_ICON } from '../activities/index.js';
import { icon, star, withIcons } from './icons.js';
import { flyStar, bump, confetti } from './fx.js';
import { createLiveSender, openAnswerWindow } from './live.js';

const TICK_MS = 200;
// 차례가 있는 놀이에서만 별판의 차례 모둠을 강조한다.
const TURN_KINDS = new Set(['word', 'gesture', 'person']);
// 축하 순서에서는 모둠별 별을 나란히 보여 주지 않는다(우리 반 합계만 — 모둠끼리 비교하지 않게).
const CLASS_ONLY_KINDS = new Set(['celebrate']);
// 규칙 안내 없이 바로 활동으로 가는 순서(인사는 패널이 곧 안내라 같은 말을 두 번 읽지 않게).
const NO_RULES_KINDS = new Set(['greet']);
// 정답 창에 정답이 뜨는 순서 — 규칙 안내의 [시작] 옆에 [실시간 정답 창 열기]를 크게 둔다.
// 축하와 이야기 나누기는 정답이 없어 단추·안내 문구를 뺀다(정답 창이 이미 열려 있으면 이야기의 질문·선생님 안내는 그대로 뜬다).
const ANSWER_KINDS = new Set(['word', 'gesture', 'quizboard', 'person']);
/** 우리 반 별 목표: 모둠 수 × 6 (6모둠이면 36개 — 40분 동안 보통 넘을 만큼) */
export const goalFor = (teamCount) => teamCount * 6;

export function runSession(root, { plan, teamCount, sfx, onExit }) {
  const state = S.createSession(plan, teamCount);
  const lastIndex = plan.steps.length - 1;
  let activity = null;
  let overtimeNotified = false;
  let last = performance.now();
  let modal = null;
  const goal = goalFor(teamCount);
  let goalDone = false;

  // ---- 선생님용 정답 창(answer.html)으로 지금 화면을 알린다 -------------------------
  // 서버도 인터넷도 필요 없다(js/ui/live.js). 정답 창이 늦게 열리면 hello 를 보내 오고, 마지막 내용을 다시 보낸다.
  let lastLive = { kind: 'idle' };
  const live = createLiveSender(() => lastLive);
  function liveSend(info) {
    const step = plan.steps[state.stepIndex];
    lastLive = { ...info, set: plan.title, stepNo: state.stepIndex + 1, stepTitle: step?.title, turn: state.turn };
    live.send(lastLive);
  }

  // [다음 순서] 버튼과 → 키가 같은 막기를 쓴다(빠른 두 번 누름 → 한 칸만).
  const guardedNext = guard(nextStep);
  // 별판 [+]·[−]도 모둠마다 막는다. 칩은 누를 때마다 새로 그려지므로 막기는 칩 밖에 둔다.
  const addStar = Array.from({ length: teamCount }, (_, t) => guard(() => {
    S.addStar(state, t);
    starsChanged();
    bump(teamsEl.querySelector(`[data-team="${t}"]`));
  }));
  const removeStar = Array.from({ length: teamCount }, (_, t) => guard(() => { S.removeStar(state, t); starsChanged(); }));

  // ---- 위쪽 띠 --------------------------------------------------------------
  const pills = plan.steps.map((step, i) =>
    h('button', { class: 'pill', type: 'button', 'data-act': `goto-${i}`, 'data-step-kind': step.kind, title: `${step.title} ${step.minutes}분`, onClick: () => onPill(i) },
      h('span', { class: 'pill-no' }, String(i + 1)), ' ', step.title),
  );
  const timerText = h('span');
  const timerEl = h('span', { class: 'timer', 'data-remain': '', 'aria-live': 'off' }, icon('timer'), ' ', timerText);
  const pauseBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'pause', onClick: togglePause });
  const muteBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'mute', onClick: toggleMute });
  const fsBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'fullscreen', title: '전체화면', 'aria-label': '전체화면', onClick: toggleFullscreen }, icon('maximize'));
  const nextBtn = h('button', { class: 'next-btn', type: 'button', 'data-act': 'next-step', onClick: guardedNext }, '다음 순서 ', icon('chevron-right'));
  // 수업 중에도 언제든 정답 창을 열 수 있게 — 아이콘만 두면 알아보기 어려워 '정답 창' 글자를 붙인다
  const answerBtn = h('button', { class: 'icon-btn answer-btn', type: 'button', 'data-act': 'answer-window', title: '선생님용 정답 창 열기 (노트북 화면에 두세요)', 'aria-label': '선생님용 정답 창 열기', onClick: openAnswerWindow }, icon('eye'), h('span', { class: 'answer-btn-text' }, '정답 창'));
  const exitBtn = h('button', { class: 'icon-btn', type: 'button', 'data-act': 'exit', title: '끝내기', 'aria-label': '끝내기', onClick: openExit }, icon('x'));
  const pausedBadge = h('div', { class: 'paused-badge', hidden: true }, icon('pause'), ' 잠깐 멈췄어요');

  // ---- 별판 -----------------------------------------------------------------
  const teamsEl = h('div', { class: 'teams' });
  const totalEl = h('span', { class: 'class-total', 'data-total': '0', 'data-goal': String(goal), title: `우리 반 별 목표 ${goal}개` });
  const goalToast = h('div', { class: 'goal-toast', hidden: true, role: 'status' }, icon('trophy'), ` 우리 반 별 목표 ${goal}개 달성!`);
  const undoBtn = h('button', { class: 'tool-btn', type: 'button', 'data-act': 'undo', title: '마지막 별 되돌리기', onClick: undo }, icon('undo-2'), ' 되돌리기');

  const stage = h('div', { class: 'stage' });

  const shell = h('div', { class: 'session' },
    h('header', { class: 'strip' },
      h('span', { class: 'strip-title' }, plan.title),
      h('nav', { class: 'pills', 'aria-label': '순서' }, pills),
      timerEl, pauseBtn, muteBtn, answerBtn, fsBtn, nextBtn, exitBtn,
    ),
    h('section', { class: 'board', 'aria-label': '모둠 별판' }, teamsEl, h('div', { class: 'board-tools' }, totalEl, undoBtn)),
    h('div', { class: 'stage-wrap' }, stage, pausedBadge, goalToast),
    h('footer', { class: 'credit credit-small' }, '문항·이야기·인물: 짬짬이'),
  );
  fill(root, shell);

  // ---- 활동에 넘기는 것 -------------------------------------------------------
  const api = {
    awardTurn() {
      const t = S.awardTurn(state);
      starsChanged([t]);
      return t;
    },
    /** 차례는 그대로 두고 그 모둠에 별 하나(몸으로 말해요: 1분 동안 맞힌 만큼) */
    addStar(team) {
      S.addStar(state, team);
      starsChanged([team]);
    },
    passTurn() {
      S.passTurn(state);
      starsChanged();
    },
    awardTeams(teams) {
      S.awardTeams(state, teams);
      starsChanged(teams);
    },
    awardAll() {
      S.awardAll(state);
      starsChanged(state.stars.map((_, i) => i));
    },
    /** 정답 창에 지금 문제를 알린다(활동이 문제를 바꿀 때마다 부름) */
    live: (info) => liveSend(info),
    goal,
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
    pauseBtn.replaceChildren(icon(state.paused ? 'play' : 'pause', { fill: true }));
    pauseBtn.setAttribute('aria-label', state.paused ? '다시 시작' : '잠깐 멈춤');
    pauseBtn.title = state.paused ? '다시 시작 (Space)' : '잠깐 멈춤 (Space)';
    pausedBadge.hidden = !state.paused;
    muteBtn.replaceChildren(icon(sfx.muted ? 'volume-x' : 'volume-2'));
    muteBtn.setAttribute('aria-label', sfx.muted ? '소리 켜기' : '소리 끄기');
    updateTimer();
  }

  function updateTimer() {
    timerText.textContent = formatRemain(state.remainMs);
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
    if (CLASS_ONLY_KINDS.has(step.kind)) {
      fill(teamsEl, h('p', { class: 'board-note' }, '모둠 별을 모두 모아 우리 반 별이 되었어요'));
    } else fill(teamsEl, state.stars.map((n, t) => {
      const isTurn = showTurn && t === state.turn;
      // 모둠 칩 자체가 [+] 버튼이다(좁은 화면에서도 모둠 이름이 잘리지 않게). [−]만 따로 둔다.
      return h('div', { class: `team${isTurn ? ' turn' : ''}`, 'data-team': String(t) },
        h('button', { class: 'team-add', type: 'button', 'data-act': `star-add-${t}`, title: `${t + 1}모둠 별 더하기`, 'aria-label': `${t + 1}모둠 별 더하기 (지금 ${n}개)`, onClick: addStar[t] },
          h('span', { class: 'team-name' }, `${t + 1}모둠`),
          h('span', { class: 'team-stars' }, star(), String(n)),
          h('span', { class: 'team-plus', 'aria-hidden': 'true' }, '+'),
        ),
        h('button', { class: 'mini', type: 'button', 'data-act': `star-remove-${t}`, title: `${t + 1}모둠 별 빼기`, 'aria-label': `${t + 1}모둠 별 빼기`, onClick: removeStar[t] }, '−'),
      );
    }));
    const total = S.totalStars(state);
    totalEl.setAttribute('data-total', String(total));
    totalEl.replaceChildren('우리 반 ', star(), String(total), h('span', { class: 'goal-of' }, `/${goal}`));
    // 목표까지 채운 만큼 칸 뒤에 노란 막대
    totalEl.style.setProperty('--goal-p', `${Math.min(100, (total / goal) * 100)}%`);
    totalEl.classList.toggle('goal-done', total >= goal);
    undoBtn.disabled = state.log.length === 0;
  }

  // gained: 방금 별을 받은 모둠들(활동에서 준 별은 화면 가운데에서 그 모둠 칩으로 날아간다)
  function starsChanged(gained = []) {
    renderBoard();
    activity?.onStars?.();
    gained.forEach((t, k) => flyStar(stage, teamsEl.querySelector(`[data-team="${t}"]`) || totalEl, k * 70));
    checkGoal();
  }

  function checkGoal() {
    if (goalDone || S.totalStars(state) < goal) return;
    goalDone = true;
    sfx.fanfare();
    confetti();
    goalToast.hidden = false;
    setTimeout(() => { goalToast.hidden = true; }, 3200);
  }

  function renderRules() {
    const step = plan.steps[state.stepIndex];
    if (NO_RULES_KINDS.has(step.kind)) {
      liveSend({ kind: 'idle', message: `${step.title} 중이에요` });
      startStep();
      return;
    }
    liveSend({ kind: 'idle', message: `${step.title} 규칙 안내 중이에요` });
    const { lines } = rulesFor(step.kind, plan.band);
    fill(stage,
      h('section', { class: 'rules', 'data-view': 'rules' },
        h('p', { class: 'rules-step' }, `${state.stepIndex + 1}번째 순서 · ${step.minutes}분`),
        h('h2', { class: 'rules-title' }, STEP_ICON[step.kind] ? icon(STEP_ICON[step.kind]) : null, ` ${step.title}`),
        h('ul', { class: 'rules-lines' }, lines.map((l) => h('li', null, withIcons(l)))),
        h('div', { class: 'rules-actions' },
          ANSWER_KINDS.has(step.kind)
            ? h('button', { class: 'btn btn-answer', type: 'button', 'data-act': 'rules-answer-window', title: '노트북 화면에 띄워 두면 정답을 미리 볼 수 있어요', onClick: openAnswerWindow }, icon('eye'), ' 실시간 정답 창 열기')
            : null,
          h('button', { class: 'btn btn-go btn-huge', type: 'button', 'data-act': 'start-step', onClick: guard(startStep) }, icon('play', { fill: true }), ' 시작'),
        ),
        h('p', { class: 'teacher-note' }, ANSWER_KINDS.has(step.kind)
          ? '선생님: 위 글을 읽어 주고 [시작]을 눌러 주세요 · 정답 창은 노트북 화면에 띄워 두세요'
          : '선생님: 위 글을 읽어 주고 [시작]을 눌러 주세요'),
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
    // [시작]을 두 번 누르면 두 번째 누름이 활동의 버튼에 닿는다 → 처음 400ms 는 무시.
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

  // 지금 진행 중인 순서의 알약을 누르면 묻고 나서 처음부터(잘못 눌러 진행이 사라지지 않게)
  function onPill(i) {
    if (i !== state.stepIndex) {
      goTo(i);
      return;
    }
    if (state.phase !== 'active') return; // 이미 규칙 안내(처음)
    openModal({
      label: '다시 시작 확인',
      q: `'${plan.steps[i].title}'을(를) 처음부터 다시 할까요?`,
      sub: '이 순서의 진행과 남은 시간이 처음으로 돌아가요. 모은 별은 그대로예요.',
      yes: ['restart-confirm', '네, 처음부터'],
      no: ['restart-cancel', '아니요, 계속해요'],
      onYes: () => {
        closeModal();
        goTo(i);
      },
    });
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

  function openModal({ label, q, sub, yes, no, onYes }) {
    if (modal) return;
    modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
      h('div', { class: 'modal-box' },
        h('p', { class: 'modal-q' }, q),
        h('p', { class: 'modal-sub' }, sub),
        h('div', { class: 'modal-btns' },
          h('button', { class: 'btn btn-warn', type: 'button', 'data-act': yes[0], onClick: onYes }, yes[1]),
          h('button', { class: 'btn', type: 'button', 'data-act': no[0], onClick: closeModal }, no[1]),
        ),
      ),
    );
    shell.append(modal);
  }

  function openExit() {
    openModal({
      label: '끝내기 확인',
      q: '처음 화면으로 돌아갈까요?',
      sub: '지금까지 모은 별과 진행 순서는 사라져요.',
      yes: ['exit-confirm', '네, 처음으로'],
      no: ['exit-cancel', '아니요, 계속해요'],
      onYes: finish,
    });
  }

  function closeModal() {
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
      closeModal();
    }
  }
  document.addEventListener('keydown', onKey);

  // 수업 중 새로고침·뒤로 가기는 별과 진행을 모두 잃으므로 브라우저가 한 번 묻게 한다(아무것도 저장하지 않음).
  function onBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = '';
  }
  window.addEventListener('beforeunload', onBeforeUnload);

  const interval = setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    S.tick(state, dt);
    if (activity && state.phase === 'active') {
      if (!state.paused) activity.tick(dt);
      else activity.pausedTick?.(dt);
    }
    updateTimer();
  }, TICK_MS);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(interval);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onBeforeUnload);
    destroyActivity();
    liveSend({ kind: 'idle', message: '수업이 끝났어요' });
    live.close();
    onExit();
  }

  renderStrip();
  renderBoard();
  renderRules();

  return { state, finish };
}
