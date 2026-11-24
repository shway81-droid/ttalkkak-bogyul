// 자료 읽기: 첫 화면은 sets.json 만으로 그리고, 나머지 자료를 받을 때 sets.json 을 다시 받지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSets, loadData } from '../js/core/data.js';

const BODIES = {
  'data/sets.json': { sets: [{ id: 'g1-lively', grade: 1, flow: 'lively' }] },
  'data/words.json': { items: ['w'] },
  'data/stories.json': { stories: ['s'] },
  'data/people.json': { people: ['p'] },
  'data/quiz.json': { items: ['q'] },
};

function fakeFetch(fail = null) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url === fail) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(BODIES[url]) };
  };
  return { fn, calls };
}

test('loadSets 는 sets.json 하나만 받는다', async () => {
  const { fn, calls } = fakeFetch();
  assert.deepEqual(await loadSets(fn), BODIES['data/sets.json'].sets);
  assert.deepEqual(calls, ['data/sets.json']);
});

test('loadData 에 받는 중인 sets 를 넘기면 sets.json 을 다시 받지 않는다', async () => {
  const { fn, calls } = fakeFetch();
  const sets = loadSets(fn);
  const data = await loadData(fn, 'data/', sets);
  assert.deepEqual(data, { words: ['w'], stories: ['s'], people: ['p'], quiz: ['q'], sets: BODIES['data/sets.json'].sets });
  assert.equal(calls.filter((u) => u === 'data/sets.json').length, 1);
  assert.equal(calls.length, 5);
});

test('loadData 만 불러도 sets 까지 모두 받는다', async () => {
  const { fn, calls } = fakeFetch();
  const data = await loadData(fn);
  assert.equal(data.sets.length, 1);
  assert.equal(calls.length, 5);
});

test('하나라도 못 받으면 파일 이름을 말하며 실패한다', async () => {
  const { fn } = fakeFetch('data/quiz.json');
  await assert.rejects(loadData(fn), /quiz\.json/);
  const { fn: fn2 } = fakeFetch('data/sets.json');
  await assert.rejects(loadSets(fn2), /sets\.json/);
});

test('단일 HTML 파일은 담아 둔 자료를 쓴다(받지 않음)', async () => {
  const { fn, calls } = fakeFetch();
  const inline = { words: [], stories: [], people: [], quiz: [], sets: [{ id: 'x' }] };
  globalThis.__BOGYUL_DATA__ = inline;
  try {
    assert.equal(await loadData(fn), inline);
    assert.equal(await loadSets(fn), inline.sets);
    assert.equal(calls.length, 0);
  } finally {
    delete globalThis.__BOGYUL_DATA__;
  }
});
