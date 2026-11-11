import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOWS, bandOf } from '../js/core/flows.js';
import { WORD_TYPES } from '../js/core/wordTypes.js';
import { buildPlan, poolFor } from '../js/core/plan.js';
import { fitsSlot } from '../js/core/drawing.js';
import { makeRng } from '../js/core/rng.js';
import { readDataDir } from '../scripts/validate-data.mjs';

const data = readDataDir();
const setById = (id) => data.sets.find((s) => s.id === id);
const BAND_LEVEL = { lower: 'easy', middle: 'normal', upper: 'hard' };

test('두 흐름 모두 합이 40분', () => {
  for (const f of ['lively', 'calm']) {
    assert.equal(FLOWS[f].slots.reduce((s, [, m]) => s + m, 0), 40, f);
    assert.ok(FLOWS[f].label && FLOWS[f].icon && FLOWS[f].blurb);
  }
});

test('bandOf: 1·2 / 3·4 / 5·6', () => {
  assert.equal(bandOf(1), 'lower');
  assert.equal(bandOf(2), 'lower');
  assert.equal(bandOf(3), 'middle');
  assert.equal(bandOf(4), 'middle');
  assert.equal(bandOf(5), 'upper');
  assert.equal(bandOf(6), 'upper');
});

test('WORD_TYPES: 9개 유형에 제목과 안내가 있다', () => {
  assert.equal(Object.keys(WORD_TYPES).length, 9);
  assert.equal(WORD_TYPES.gesture, undefined);
  for (const [k, v] of Object.entries(WORD_TYPES)) assert.ok(v.title && v.ask, k);
});

test('g3-lively 계획: 순서·분·제목', () => {
  const plan = buildPlan(setById('g3-lively'), data, makeRng(1));
  assert.deepEqual(plan.steps.map((s) => s.kind), ['greet', 'word', 'gesture', 'story', 'draw', 'celebrate']);
  assert.deepEqual(plan.steps.map((s) => s.minutes), [3, 10, 10, 7, 8, 2]);
  assert.deepEqual(plan.steps.map((s) => s.title), ['인사', '말놀이', '몸으로 말해요', '이야기', '그리기', '축하']);
  assert.equal(plan.title, '3학년 · 신나게 열기');
  assert.equal(plan.setId, 'g3-lively');
  assert.equal(plan.grade, 3);
  assert.equal(plan.band, 'middle');
  assert.equal(plan.flow, 'lively');
});

test('g3-calm 계획의 순서', () => {
  const plan = buildPlan(setById('g3-calm'), data, makeRng(1));
  assert.deepEqual(plan.steps.map((s) => s.kind), ['greet', 'draw', 'story', 'word', 'quizboard', 'celebrate']);
  assert.equal(plan.steps[4].title, '상식 퀴즈');
});

test('word 덱 30장은 세트의 유형·난이도 안에서 겹치지 않는다', () => {
  const set = setById('g3-lively');
  const plan = buildPlan(set, data, makeRng(5));
  const deck = plan.steps.find((s) => s.kind === 'word').content.deck;
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const w = deck.next();
    assert.ok(set.word.types.includes(w.type), w.id);
    assert.ok(set.word.levels.includes(w.level), w.id);
    assert.ok(!seen.has(w.id), '중복 ' + w.id);
    seen.add(w.id);
  }
});

test('gesture 덱은 gesture 유형·세트 난이도', () => {
  const set = setById('g3-lively');
  const deck = buildPlan(set, data, makeRng(2)).steps.find((s) => s.kind === 'gesture').content.deck;
  for (let i = 0; i < 20; i++) {
    const w = deck.next();
    assert.equal(w.type, 'gesture');
    assert.ok(set.team.levels.includes(w.level));
  }
});

test('quizboard 덱 문항은 모두 세트 학년대 것', () => {
  for (const id of ['g1-calm', 'g3-calm', 'g6-lively']) {
    const set = setById(id);
    const band = bandOf(set.grade);
    const deck = buildPlan(set, data, makeRng(3)).steps.find((s) => s.kind === 'quizboard').content.deck;
    for (let i = 0; i < 40; i++) assert.ok(deck.next().bands.includes(band), id);
  }
});

test('story 는 학년대, draw 는 학년대 난이도이고 시간에 맞으며 꾸미기 문구가 채워진다', () => {
  for (const set of data.sets) {
    const band = bandOf(set.grade);
    const plan = buildPlan(set, data, makeRng(11));
    const story = plan.steps.find((s) => s.kind === 'story').content.story;
    assert.ok(story.grades.includes(band), set.id);
    const { drawing, decorate } = plan.steps.find((s) => s.kind === 'draw').content;
    assert.equal(drawing.difficulty, BAND_LEVEL[band], set.id);
    assert.ok(fitsSlot(drawing), set.id);
    assert.ok(decorate.length > 0 && !decorate.includes('{title}'), decorate);
    assert.ok(decorate.includes(drawing.title), decorate);
  }
});

test('poolFor: 슬롯마다 후보를 준다', () => {
  const set = setById('g2-calm');
  assert.ok(poolFor('word', set, data).length >= 30);
  assert.ok(poolFor('team', set, data).every((w) => w.type === 'gesture'));
  assert.ok(poolFor('story', set, data).length >= 3);
  assert.ok(poolFor('draw', set, data).length >= 3);
});

test('같은 씨앗이면 같은 계획', () => {
  const set = setById('g4-calm');
  const a = buildPlan(set, data, makeRng(77));
  const b = buildPlan(set, data, makeRng(77));
  const pick = (p, k) => p.steps.find((s) => s.kind === k).content;
  assert.equal(pick(a, 'story').story.id, pick(b, 'story').story.id);
  assert.equal(pick(a, 'draw').drawing.id, pick(b, 'draw').drawing.id);
  assert.equal(pick(a, 'draw').decorate, pick(b, 'draw').decorate);
  for (const k of ['word', 'gesture']) {
    const da = pick(a, k).deck;
    const db = pick(b, k).deck;
    for (let i = 0; i < 5; i++) assert.equal(da.next().id, db.next().id, k);
  }
});
