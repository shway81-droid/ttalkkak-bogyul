import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateData, readDataDir } from '../scripts/validate-data.mjs';

const fresh = () => structuredClone(readDataDir());

test('실제 자료는 오류가 없다', () => {
  assert.deepEqual(validateData(readDataDir()), []);
});

test('세트가 빠지면 그 세트를 말한다', () => {
  const data = fresh();
  data.sets = data.sets.filter((s) => s.id !== 'g3-calm');
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('g3-calm')), errs.join('\n'));
});

test('말놀이 후보가 30개 미만이면 그 세트 id 가 든 오류', () => {
  const data = fresh();
  const set = data.sets.find((s) => s.id === 'g3-lively');
  set.word = { types: ['mimetic'], levels: ['hard'] };
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('g3-lively') && e.includes('말놀이')), errs.join('\n'));
});

test('같은 학년 두 세트의 모둠 놀이 종류가 같으면 오류', () => {
  const data = fresh();
  data.sets.find((s) => s.id === 'g2-calm').team = { kind: 'quizboard' };
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('2학년') && e.includes('모둠 놀이')), errs.join('\n'));
});

test('같은 학년 두 세트의 말놀이 유형이 겹치면 오류', () => {
  const data = fresh();
  data.sets.find((s) => s.id === 'g4-calm').word.types = ['proverb', 'riddle'];
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('4학년') && e.includes('proverb')), errs.join('\n'));
});

test('꾸미기 문구에 {title} 바로 뒤 조사가 있으면 오류', () => {
  const data = fresh();
  data.decorate.animal[0] = '{title}이 사는 곳을 그려요';
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('animal') && e.includes('조사')), errs.join('\n'));
});

test('꾸미기 문구가 3개가 아닌 주제는 오류', () => {
  const data = fresh();
  data.decorate.food = data.decorate.food.slice(0, 2);
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('food')), errs.join('\n'));
});
