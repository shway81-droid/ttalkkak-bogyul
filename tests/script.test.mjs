import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScript, TALLY } from '../js/core/script.js';
import { buildPlan } from '../js/core/plan.js';
import { makeRng } from '../js/core/rng.js';
import { readDataDir } from '../scripts/validate-data.mjs';

const data = readDataDir();
const planOf = (id, seed = 4) => buildPlan(data.sets.find((s) => s.id === id), data, makeRng(seed));

test('g3-lively 대본: 섹션 6개, 분 합 40, 제목', () => {
  const plan = planOf('g3-lively');
  const sc = buildScript(plan);
  assert.equal(sc.title, '3학년 · 신나게 열기');
  assert.equal(sc.sections.length, 6);
  assert.equal(sc.sections.reduce((s, x) => s + x.minutes, 0), 40);
  for (const sec of sc.sections) assert.ok(sec.how.length >= 1, sec.title);
  assert.equal(sc.tally, TALLY);
  assert.equal(TALLY, '칠판에 모둠별로 바를 정 자를 한 획씩 그어 별을 셉니다');
});

test('말놀이 섹션: 문제 10개, 정답이 모두 있다', () => {
  const sc = buildScript(planOf('g3-lively'));
  const word = sc.sections[1];
  assert.equal(word.title, '말놀이');
  assert.equal(word.items.length, 10);
  for (const it of word.items) {
    assert.ok(it.q.length > 0);
    assert.ok(it.a.length > 0);
  }
});

test('몸으로 말해요 섹션: 제시어 15개', () => {
  const sc = buildScript(planOf('g3-lively'));
  const g = sc.sections.find((s) => s.title === '몸으로 말해요');
  assert.equal(g.words.length, 15);
  assert.equal(new Set(g.words).size, 15);
});

test('상식 퀴즈 섹션: 문항 10개, 문제에 보기 4개, 정답이 보기 안에', () => {
  const sc = buildScript(planOf('g3-calm'));
  const q = sc.sections.find((s) => s.title === '상식 퀴즈');
  assert.equal(q.items.length, 10);
  for (const it of q.items) {
    for (const mark of ['①', '②', '③', '④']) assert.ok(it.q.includes(mark), it.q);
    assert.match(it.a, /^[①②③④] /);
  }
});

test('이야기 섹션: 본문은 원본 그대로, 질문은 중심 질문 + 이어지는 질문', () => {
  const plan = planOf('g3-lively');
  const story = plan.steps.find((s) => s.kind === 'story').content.story;
  const sec = buildScript(plan).sections.find((s) => s.title === '이야기');
  assert.equal(sec.story.title, story.title);
  assert.deepEqual(sec.story.text, story.story);
  assert.deepEqual(sec.story.questions, [story.mainQuestion, ...story.followUpQuestions]);
});

test('인물 퀴즈 섹션: 힌트와 이름 10개, 겹치지 않음', () => {
  for (const id of ['g1-lively', 'g6-calm']) {
    const sec = buildScript(planOf(id)).sections.find((s) => s.title === '인물 퀴즈');
    assert.equal(sec.items.length, 10, id);
    assert.equal(new Set(sec.items.map((it) => it.a)).size, 10, id);
    for (const it of sec.items) {
      assert.ok(it.q.includes('·'), it.q); // 초성 · 한 줄 설명
      assert.ok(it.a.length > 0);
    }
  }
  const people = new Map(data.people.map((p) => [p.answer, p]));
  for (const it of buildScript(planOf('g3-calm')).sections.find((s) => s.title === '인물 퀴즈').items) {
    assert.equal(it.q, people.get(it.a).hint);
  }
});
