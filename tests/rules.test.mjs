import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesFor } from '../js/core/rules.js';

const KINDS = ['greet', 'word', 'gesture', 'quizboard', 'story', 'draw', 'celebrate'];
const BANDS = ['lower', 'middle', 'upper'];

test('모든 활동·학년대에 1~3줄 규칙이 있다', () => {
  for (const kind of KINDS) {
    for (const band of BANDS) {
      const r = rulesFor(kind, band);
      assert.ok(r.lines.length >= 1 && r.lines.length <= 3, `${kind}/${band}`);
      for (const line of r.lines) assert.ok(line.trim().length > 0, `${kind}/${band}`);
    }
  }
});

test('저학년 규칙은 줄마다 25자 이하', () => {
  for (const kind of KINDS) {
    for (const line of rulesFor(kind, 'lower').lines) {
      assert.ok(line.length <= 25, `${kind}: "${line}" ${line.length}자`);
    }
  }
});

test('순위를 떠올리게 하는 말이 없다', () => {
  for (const kind of KINDS) {
    for (const band of BANDS) {
      const r = rulesFor(kind, band);
      for (const line of [...r.lines, r.prep || '']) {
        for (const bad of ['등', '1위', '우승']) assert.ok(!line.includes(bad), `${kind}/${band}: "${line}"`);
      }
    }
  }
});

test('그리기에는 준비물 안내가 있다', () => {
  for (const band of BANDS) assert.equal(rulesFor('draw', band).prep, '종이(공책 뒷장도 좋아요)와 연필을 꺼내요');
  assert.equal(rulesFor('word', 'middle').prep, undefined);
});

test('차례 놀이에는 먼저 외치지 않기, 퀴즈에는 손가락 답이 들어 있다', () => {
  for (const band of BANDS) {
    assert.ok(rulesFor('word', band).lines.some((l) => l.includes('외치지')), band);
    assert.ok(rulesFor('quizboard', band).lines.some((l) => l.includes('손가락')), band);
    assert.ok(rulesFor('gesture', band).lines.some((l) => l.includes('몸')), band);
  }
});
