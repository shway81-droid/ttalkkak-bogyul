import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pathLength, stepSeconds, drawingTiming, fitsSlot,
  SEC_BASE, SEC_PER_LENGTH, SEC_PER_EXTRA_STROKE, SEC_RANGE,
} from '../js/core/drawing.js';

const near = (actual, expected, tol = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} 이 ${expected}±${tol} 이 아닙니다`);

// 직선 획: (x0,y0) → (x1,y1), 3차 베지어로 표현
const line = (x0, y0, x1, y1) => `M ${x0} ${y0} C ${x0} ${y0}, ${x1} ${y1}, ${x1} ${y1}`;

test('상수는 짬짬이 그리기 공식과 같다', () => {
  assert.equal(SEC_BASE, 8);
  assert.equal(SEC_PER_LENGTH, 12);
  assert.equal(SEC_PER_EXTRA_STROKE, 2);
  assert.deepEqual(SEC_RANGE, [10, 30]);
});

test('pathLength: 직선 베지어 하나의 길이', () => {
  near(pathLength('M 0 0 C 0 0, 100 0, 100 0'), 100);
});

test('pathLength: C가 이어지면 앞 곡선의 끝점에서 시작한다', () => {
  near(pathLength('M 0 0 C 0 0, 30 0, 30 0 C 30 0, 30 40, 30 40'), 70);
});

test('stepSeconds: 아주 짧은 획은 하한 10초', () => {
  assert.equal(stepSeconds({ d: ['M 0 0 C 0 0, 1 0, 1 0'] }, '0 0 400 500'), 10);
});

test('stepSeconds: 대각선의 절반 길이 획 하나는 14초', () => {
  assert.equal(stepSeconds({ d: [line(0, 0, 250, 0)] }, '0 0 300 400'), 14);
});

test('stepSeconds: 125 길이 획 둘은 16초 (획 하나 더할 때 +2)', () => {
  assert.equal(stepSeconds({ d: [line(0, 0, 125, 0), line(0, 10, 125, 10)] }, '0 0 300 400'), 16);
});

test('stepSeconds: 아주 긴 획은 상한 30초', () => {
  assert.equal(stepSeconds({ d: [line(0, 0, 1500, 0)] }, '0 0 300 400'), 30);
});

test('stepSeconds: seconds 가 있으면 그 값을 쓴다', () => {
  assert.equal(stepSeconds({ d: [line(0, 0, 250, 0)], seconds: 17 }, '0 0 300 400'), 17);
});

test('drawingTiming: totalSec 은 단계 시간의 합', () => {
  const a = { d: [line(0, 0, 250, 0)] };
  const b = { d: [line(0, 0, 125, 0), line(0, 10, 125, 10)] };
  const t = drawingTiming({ viewBox: '0 0 300 400', steps: [a, b] });
  assert.deepEqual(t.sec, [14, 16]);
  assert.equal(t.totalSec, 30);
});

test('fitsSlot: 그리기+색칠이 꾸미기 60초를 남기지 못하면 false', () => {
  assert.equal(fitsSlot({ totalSec: 300, coloringSeconds: 150 }), false);
});

test('fitsSlot: 꾸미기 60초 이상 남으면 true', () => {
  assert.equal(fitsSlot({ totalSec: 200, coloringSeconds: 150 }), true);
});
