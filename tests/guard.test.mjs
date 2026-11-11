import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from '../js/ui/guard.js';

test('guard: 400ms 안의 두 번째 누름은 무시한다', () => {
  let t = 0;
  let runs = 0;
  const g = guard(() => { runs++; }, 400, () => t);
  t = 0; g();
  t = 100; g();
  t = 450; g();
  assert.equal(runs, 2);
});

test('guard: 인자와 반환값을 그대로 넘긴다', () => {
  let t = 0;
  const g = guard((a, b) => a + b, 400, () => t);
  assert.equal(g(2, 3), 5);
  t = 10;
  assert.equal(g(2, 3), undefined);
});
