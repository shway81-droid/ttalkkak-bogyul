import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession, beginStep, goToStep, nextStep, tick, isOvertime, togglePause,
  addStar, removeStar, awardTurn, passTurn, awardTeams, awardAll, undo, totalStars,
} from '../js/core/session.js';

// greet 3, word 10, team 10, story 7, draw 8, celebrate 2
const PLAN = {
  steps: [3, 10, 10, 7, 8, 2].map((minutes, i) => ({ kind: `k${i}`, minutes })),
};

test('생성 직후: 규칙 화면, 첫 순서 시간, 별 0', () => {
  const s = createSession(PLAN, 6);
  assert.equal(s.phase, 'rules');
  assert.equal(s.stepIndex, 0);
  assert.equal(s.remainMs, 180000);
  assert.equal(s.paused, false);
  assert.deepEqual(s.stars, [0, 0, 0, 0, 0, 0]);
  assert.equal(s.turn, 0);
  assert.deepEqual(s.log, []);
});

test('규칙 화면에서는 시간이 흐르지 않고, 시작하면 흐른다', () => {
  const s = createSession(PLAN, 6);
  tick(s, 5000);
  assert.equal(s.remainMs, 180000);
  beginStep(s);
  assert.equal(s.phase, 'active');
  tick(s, 5000);
  assert.equal(s.remainMs, 175000);
});

test('멈춘 동안 시간은 그대로, 별은 줄 수 있다', () => {
  const s = createSession(PLAN, 6);
  beginStep(s);
  togglePause(s);
  assert.equal(s.paused, true);
  tick(s, 5000);
  assert.equal(s.remainMs, 180000);
  awardTurn(s);
  assert.equal(s.stars[0], 1);
  assert.equal(s.remainMs, 180000);
  togglePause(s);
  tick(s, 1000);
  assert.equal(s.remainMs, 179000);
});

test('멈춘 채 다른 순서로 가면 멈춤이 풀리고 규칙 화면부터', () => {
  const s = createSession(PLAN, 6);
  beginStep(s);
  awardTurn(s);
  togglePause(s);
  goToStep(s, 1);
  assert.equal(s.paused, false);
  assert.equal(s.phase, 'rules');
  assert.equal(s.stepIndex, 1);
  assert.equal(s.remainMs, 600000);
  assert.equal(s.stars[0], 1, '별은 유지');
  assert.equal(s.turn, 1, '차례도 유지');
});

test('시간이 지나도 저절로 넘어가지 않는다', () => {
  const s = createSession(PLAN, 6);
  beginStep(s);
  assert.equal(isOvertime(s), false);
  tick(s, 200000);
  assert.equal(isOvertime(s), true);
  assert.equal(s.stepIndex, 0);
  assert.ok(s.remainMs < 0);
});

test('8모둠에 차례 별 9번 → 첫 모둠만 2개, 차례는 2모둠', () => {
  const s = createSession(PLAN, 8);
  const given = [];
  for (let i = 0; i < 9; i++) given.push(awardTurn(s));
  assert.deepEqual(given, [0, 1, 2, 3, 4, 5, 6, 7, 0]);
  assert.deepEqual(s.stars, [2, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(s.turn, 1);
  assert.equal(totalStars(s), 9);
});

test('passTurn: 별 없이 차례만 넘어간다', () => {
  const s = createSession(PLAN, 4);
  passTurn(s);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.stars, [0, 0, 0, 0]);
  assert.deepEqual(s.log, []);
  passTurn(s); passTurn(s); passTurn(s);
  assert.equal(s.turn, 0);
});

test('awardTeams: 여러 모둠에 한 번의 기록으로', () => {
  const s = createSession(PLAN, 5);
  awardTeams(s, [0, 2, 4]);
  assert.deepEqual(s.stars, [1, 0, 1, 0, 1]);
  assert.equal(s.log.length, 1);
});

test('awardAll 후 undo 한 번이면 모두 원래대로', () => {
  const s = createSession(PLAN, 6);
  awardTurn(s);
  awardAll(s);
  assert.deepEqual(s.stars, [2, 1, 1, 1, 1, 1]);
  assert.equal(undo(s), true);
  assert.deepEqual(s.stars, [1, 0, 0, 0, 0, 0]);
});

test('awardTurn 후 undo → 별과 차례 모두 원래대로', () => {
  const s = createSession(PLAN, 6);
  passTurn(s);
  awardTurn(s);
  assert.equal(s.turn, 2);
  assert.equal(undo(s), true);
  assert.deepEqual(s.stars, [0, 0, 0, 0, 0, 0]);
  assert.equal(s.turn, 1);
});

test('기록보다 많이 undo 해도 별은 음수가 되지 않는다', () => {
  const s = createSession(PLAN, 4);
  awardTurn(s);
  assert.equal(undo(s), true);
  assert.equal(undo(s), false);
  assert.equal(undo(s), false);
  assert.deepEqual(s.stars, [0, 0, 0, 0]);
});

test('0인 모둠 removeStar 는 아무것도 하지 않고 기록도 없다', () => {
  const s = createSession(PLAN, 4);
  removeStar(s, 2);
  assert.deepEqual(s.stars, [0, 0, 0, 0]);
  assert.deepEqual(s.log, []);
});

test('addStar·removeStar 도 되돌릴 수 있다', () => {
  const s = createSession(PLAN, 4);
  addStar(s, 3);
  addStar(s, 3);
  removeStar(s, 3);
  assert.equal(s.stars[3], 1);
  undo(s);
  assert.equal(s.stars[3], 2);
  undo(s);
  undo(s);
  assert.equal(s.stars[3], 0);
  assert.equal(undo(s), false);
});

test('nextStep: 마지막 순서에서는 그대로', () => {
  const s = createSession(PLAN, 6);
  nextStep(s);
  assert.equal(s.stepIndex, 1);
  assert.equal(s.remainMs, 600000);
  goToStep(s, 5);
  nextStep(s);
  assert.equal(s.stepIndex, 5);
});
