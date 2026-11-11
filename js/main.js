// 시작점: 자료 읽기 → 첫 화면 → 세트 진행.
import { loadData } from './core/data.js';
import { buildPlan } from './core/plan.js';
import { makeRng } from './core/rng.js';
import { renderStart } from './ui/start.js';
import { runSession } from './ui/runner.js';
import { createSfx } from './ui/sfx.js';
import { h, fill } from './ui/dom.js';

const root = document.getElementById('app');
const sfx = createSfx();
let data = null;

function showStart() {
  renderStart(root, { sets: data.sets, onStart, onPrint });
}

function onStart({ grade, flow, teams }) {
  const set = data.sets.find((s) => s.grade === grade && s.flow === flow);
  if (!set) return;
  const seed = (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  const plan = buildPlan(set, data, makeRng(seed));
  runSession(root, { plan, teamCount: teams, sfx, onExit: showStart });
}

function onPrint({ grade, flow }) {
  window.open(`print.html?grade=${grade}&flow=${flow}`, '_blank', 'noopener');
}

async function boot() {
  try {
    data = await loadData();
  } catch (err) {
    fill(root, h('main', { class: 'start' }, h('p', { class: 'load-error' }, '자료를 읽지 못했어요. 새로고침해 주세요.')));
    throw err;
  }
  showStart();
}

boot();
