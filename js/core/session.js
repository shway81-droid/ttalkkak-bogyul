// 수업 한 번의 상태: 순서·남은 시간·멈춤·차례·별·되돌리기 기록.
// 모든 함수는 상태 객체를 직접 바꾼다. 화면은 이 상태를 읽어 그리기만 한다.

const stepMs = (s, i) => s.plan.steps[i].minutes * 60000;

export function createSession(plan, teamCount) {
  return {
    plan,
    teamCount,
    stepIndex: 0,
    phase: 'rules',
    remainMs: plan.steps[0].minutes * 60000,
    paused: false,
    stars: Array(teamCount).fill(0),
    turn: 0,
    log: [],
  };
}

export function beginStep(s) {
  s.phase = 'active';
}

export function goToStep(s, i) {
  if (i < 0 || i >= s.plan.steps.length) return;
  s.stepIndex = i;
  s.phase = 'rules';
  s.remainMs = stepMs(s, i);
  s.paused = false;
}

export function nextStep(s) {
  if (s.stepIndex >= s.plan.steps.length - 1) return;
  goToStep(s, s.stepIndex + 1);
}

export function tick(s, dtMs) {
  if (s.phase !== 'active' || s.paused) return;
  s.remainMs -= dtMs;
}

export function isOvertime(s) {
  return s.remainMs <= 0;
}

export function togglePause(s) {
  s.paused = !s.paused;
}

function apply(s, teams, delta) {
  s.log.push({ teams: teams.slice(), delta, prevTurn: s.turn });
  for (const t of teams) s.stars[t] = Math.max(0, s.stars[t] + delta);
}

const nextTurn = (s) => {
  s.turn = (s.turn + 1) % s.teamCount;
};

export function addStar(s, team) {
  apply(s, [team], 1);
}

export function removeStar(s, team) {
  if (s.stars[team] <= 0) return;
  apply(s, [team], -1);
}

/** 차례 모둠에 별 하나, 차례를 다음으로. 별을 받은 모둠 번호를 돌려준다 */
export function awardTurn(s) {
  const team = s.turn;
  apply(s, [team], 1);
  nextTurn(s);
  return team;
}

export function passTurn(s) {
  nextTurn(s);
}

export function awardTeams(s, teams) {
  if (!teams.length) return;
  apply(s, teams, 1);
}

export function awardAll(s) {
  awardTeams(s, s.stars.map((_, i) => i));
}

/** 마지막 별 기록 하나를 되돌린다. 차례도 그 기록 전으로. */
export function undo(s) {
  const last = s.log.pop();
  if (!last) return false;
  for (const t of last.teams) s.stars[t] = Math.max(0, s.stars[t] - last.delta);
  s.turn = last.prevTurn;
  return true;
}

export function totalStars(s) {
  return s.stars.reduce((a, b) => a + b, 0);
}
