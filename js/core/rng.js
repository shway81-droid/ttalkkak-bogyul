// 씨앗이 있는 무작위 수(mulberry32)와 섞기·뽑기 더미.

/** 씨앗이 같으면 같은 수열을 내는 [0,1) 난수 함수 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 원본을 건드리지 않고 섞은 새 배열 (Fisher–Yates) */
export function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 겹치지 않게 한 장씩 내주는 더미. 다 쓰면 다시 섞고,
 * 새로 섞은 첫 장이 직전 장과 같지 않게 한다.
 */
export function makeDeck(items, rng) {
  let order = [];
  let pos = 0;
  let last;
  let started = false;

  function refill() {
    order = shuffle(items, rng);
    pos = 0;
    if (started && order.length > 1 && order[0] === last) {
      const k = 1 + Math.floor(rng() * (order.length - 1));
      [order[0], order[k]] = [order[k], order[0]];
    }
  }

  return {
    size: items.length,
    next() {
      if (pos >= order.length) refill();
      last = order[pos++];
      started = true;
      return last;
    },
  };
}
