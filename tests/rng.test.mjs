import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, shuffle, makeDeck } from '../js/core/rng.js';

test('makeRng: 같은 씨앗이면 같은 수열, 값은 [0,1)', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 50; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('shuffle: 원래 원소의 순열인 새 배열을 준다', () => {
  const src = [1, 2, 3, 4, 5, 6, 7];
  const out = shuffle(src, makeRng(3));
  assert.notEqual(out, src);
  assert.deepEqual([...out].sort((x, y) => x - y), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7]);
});

test('makeDeck: 세 장을 뽑으면 1·2·3이 한 번씩', () => {
  const deck = makeDeck([1, 2, 3], makeRng(9));
  assert.equal(deck.size, 3);
  const got = [deck.next(), deck.next(), deck.next()].sort();
  assert.deepEqual(got, [1, 2, 3]);
});

test('makeDeck: 다시 섞을 때 직전 장이 연달아 나오지 않는다 (씨앗 1~200)', () => {
  for (const items of [[1, 2], [1, 2, 3], [1, 2, 3, 4, 5]]) {
    for (let seed = 1; seed <= 200; seed++) {
      const deck = makeDeck(items, makeRng(seed));
      let prev = deck.next();
      for (let i = 1; i < 30; i++) {
        const cur = deck.next();
        assert.notEqual(cur, prev, `seed ${seed}, items ${items}, i ${i}`);
        prev = cur;
      }
    }
  }
});

test('makeDeck: 한 장뿐이면 계속 그 장', () => {
  const deck = makeDeck([7], makeRng(1));
  for (let i = 0; i < 5; i++) assert.equal(deck.next(), 7);
});
