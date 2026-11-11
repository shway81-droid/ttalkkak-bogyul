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

test('인물 후보가 20명 미만이면 그 세트 id 가 든 오류', () => {
  const data = fresh();
  data.people = data.people.filter((p) => p.level !== 'easy').concat(data.people.filter((p) => p.level === 'easy').slice(0, 5));
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes('g1-lively') && e.includes('인물 퀴즈')), errs.join('\n'));
});

test('인물 사진 파일이 없으면 그 인물 id 가 든 오류', () => {
  const data = fresh();
  data.people[0].photo.file = 'assets/people/없는-사진.webp';
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes(data.people[0].id) && e.includes('사진')), errs.join('\n'));
});

test('인물 사진의 저작자·라이선스·원본 주소가 비면 오류', () => {
  for (const key of ['author', 'license', 'source']) {
    const data = fresh();
    data.people[3].photo[key] = '';
    const errs = validateData(data);
    assert.ok(errs.some((e) => e.includes(data.people[3].id) && e.includes(key)), `${key}: ${errs.join('\n')}`);
  }
});

test('사진 저작자 이름이 잘려 있으면(… 나 ... 로 끝나면) 그 인물 id 가 든 오류', () => {
  for (const cut of ['Korea.net / Korean Culture (Jeon …', 'Somebody Ph…', 'Long name ...']) {
    const data = fresh();
    data.people[7].photo.author = cut;
    const errs = validateData(data);
    assert.ok(errs.some((e) => e.includes(data.people[7].id) && e.includes('저작자')), `${cut}: ${errs.join('\n')}`);
  }
});
