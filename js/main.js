// 시작점: 학년·흐름 목록 읽기 → 첫 화면 → 세트 진행.
// 첫 화면은 sets.json(2KB)만 받으면 바로 그린다. 문항·이야기·인물 자료(약 1MB)는 그동안 뒤에서 받고,
// [시작]을 누를 때 아직 오는 중이면 그때 기다린다(느린 학교 망에서 하얀 화면으로 기다리지 않게).
import { loadSets, loadData } from './core/data.js';
import { buildPlan } from './core/plan.js';
import { makeRng } from './core/rng.js';
import { renderStart } from './ui/start.js';
import { runSession } from './ui/runner.js';
import { createSfx } from './ui/sfx.js';
import { h, fill } from './ui/dom.js';

const root = document.getElementById('app');
const sfx = createSfx();
let sets = null;
let dataReady = null;
let starting = false;

function showLoadError() {
  fill(root, h('main', { class: 'start' }, h('p', { class: 'load-error' }, '자료를 읽지 못했어요. 새로고침해 주세요.')));
}

function showStart() {
  renderStart(root, { sets, onStart });
}

async function onStart({ grade, flow, teams }) {
  const set = sets.find((s) => s.grade === grade && s.flow === flow);
  if (!set || starting) return;
  starting = true;
  let data;
  try {
    data = await dataReady;
  } catch (err) {
    showLoadError();
    throw err;
  } finally {
    starting = false;
  }
  const seed = (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  const plan = buildPlan(set, data, makeRng(seed));
  runSession(root, { plan, teamCount: teams, sfx, onExit: showStart });
}

// 한 번 열면 인터넷이 끊겨도 쓸 수 있게(sw.js). 서비스 워커는 설치하면서 화면 파일과 인물 사진(약 4MB)을
// 한꺼번에 받으므로, 첫 화면·글꼴·자료를 다 받은 뒤에 등록한다(먼저 등록하면 느린 망에서 대역폭을 나눠 써
// 글꼴이 늦게 바뀐다). 단일 HTML 파일은 그 자체가 오프라인이라 등록하지 않는다.
function registerOffline() {
  if (!('serviceWorker' in navigator) || globalThis.__BOGYUL_SINGLE__) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function boot() {
  const setsReady = loadSets();
  dataReady = loadData(fetch, 'data/', setsReady);
  // 실패는 [시작]을 누를 때 알린다(첫 화면이 먼저 떠 있으므로)
  dataReady.catch(() => {});
  const fontReady = document.fonts ? document.fonts.load('1em "Pretendard Variable"') : null;
  Promise.allSettled([dataReady, fontReady]).then(registerOffline);
  try {
    sets = await setsReady;
  } catch (err) {
    showLoadError();
    throw err;
  }
  showStart();
}

boot();
