// 브라우저 검사(Playwright). 서버를 띄우고 실제 화면을 마우스로 눌러 본다.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';

const GUARD_WAIT = 450; // 두 번 눌림 막기(400ms)보다 조금 길게
const SETS = JSON.parse(readFileSync(new URL('../data/sets.json', import.meta.url), 'utf8')).sets;
// 브라우저 기본 여백(약 10mm)보다 조금 넓게 잡아도 한 장에 들어가야 한다.
const PRINT_MARGIN = { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' };

const act = (name) => `[data-act="${name}"]`;

export async function click(page, name) {
  await page.locator(act(name)).first().click();
}

export async function totalStars(page) {
  return Number(await page.locator('[data-total]').first().getAttribute('data-total'));
}

/**
 * 활동마다 runSet 이 하는 기본 조작. (page, info) => 그 활동에서 준 별 수.
 * Task 7~10 이 kind 별로 채운다.
 */
export const ACT_STEPS = {};

ACT_STEPS.word = async (page) => {
  await click(page, 'correct');
  return 1;
};

ACT_STEPS.gesture = async (page) => {
  await click(page, 'show-word');
  await page.waitForTimeout(GUARD_WAIT);
  await click(page, 'correct');
  return 1;
};

ACT_STEPS.quizboard = async (page) => {
  await click(page, 'reveal');
  await page.waitForTimeout(GUARD_WAIT);
  await click(page, 'team-toggle-0');
  await click(page, 'award-and-next');
  return 1;
};

ACT_STEPS.story = async (page, { teams }) => {
  await click(page, 'award-all');
  return teams;
};

ACT_STEPS.draw = async (page, { teams }) => {
  await click(page, 'draw-start');
  await page.waitForTimeout(GUARD_WAIT);
  await click(page, 'award-all');
  return teams;
};

/** 세트를 열고 kind 순서의 활동 화면까지 바로 간다 */
export async function openStep(page, base, { grade, flow = 'lively', teams = 6, kind }) {
  await page.goto(base);
  await click(page, `grade-${grade}`);
  await click(page, `flow-${flow}`);
  await click(page, `teams-${teams}`);
  await click(page, 'start');
  await page.locator(`[data-step-kind="${kind}"]`).first().click();
  await click(page, 'start-step');
  await page.locator(`[data-kind="${kind}"]`).waitFor();
  await page.waitForTimeout(GUARD_WAIT);
}

const inViewport = async (page, selector) => {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1;
};

/** 첫 화면에서 세트를 골라 축하 화면까지 진행한다 */
export async function runSet(page, { grade, flow, teams }, base) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await click(page, `grade-${grade}`);
  await click(page, `flow-${flow}`);
  await click(page, `teams-${teams}`);
  await click(page, 'start');
  let given = 0;
  const count = await page.locator('[data-act^="goto-"]').count();
  for (let i = 0; i < count; i++) {
    await page.locator(act('start-step')).waitFor();
    await click(page, 'start-step');
    await page.waitForTimeout(GUARD_WAIT); // 활동은 처음 400ms 누름을 무시한다
    const kind = await page.locator('[data-kind]').first().getAttribute('data-kind');
    if (ACT_STEPS[kind]) given += (await ACT_STEPS[kind](page, { grade, flow, teams })) || 0;
    if (i < count - 1) {
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'next-step');
    }
  }
  return { errors, given };
}

/** 화면이 넘치는지: 문서 스크롤과 활동 자리(.stage, 넘치면 잘림) 안쪽을 함께 본다. 넘치면 까닭, 아니면 '' */
async function overflowOf(page) {
  return page.evaluate(() => {
    const se = document.scrollingElement;
    const stage = document.querySelector('.stage');
    const bad = [];
    if (se.scrollHeight > innerHeight + 1) bad.push(`문서 ${se.scrollHeight}>${innerHeight}`);
    if (se.scrollWidth > innerWidth + 1) bad.push(`문서 가로 ${se.scrollWidth}>${innerWidth}`);
    if (stage && stage.scrollHeight > stage.clientHeight + 1) bad.push(`활동 ${stage.scrollHeight}>${stage.clientHeight}`);
    if (stage && stage.scrollWidth > stage.clientWidth + 1) bad.push(`활동 가로 ${stage.scrollWidth}>${stage.clientWidth}`);
    return bad.join(', ');
  });
}

/** 활동 안에서 화면이 가장 붐비는 곳까지 들어가 본다. look(이름)이 그 자리를 잰다. */
const SWEEP = {
  greet: async (page, look) => {
    for (let k = 2; k <= 4; k++) {
      await click(page, 'greet-next');
      await page.waitForTimeout(GUARD_WAIT);
      await look(`패널 ${k}`);
    }
  },
  word: async (page, look) => {
    if (await page.locator(act('hint')).isEnabled()) {
      await click(page, 'hint');
      await look('힌트');
    }
    await click(page, 'reveal');
    await page.waitForTimeout(GUARD_WAIT);
    await look('정답');
  },
  gesture: async (page, look) => {
    await click(page, 'show-word');
    await page.waitForTimeout(GUARD_WAIT);
    await look('낱말');
  },
  quizboard: async (page, look) => {
    await click(page, 'reveal');
    await page.waitForTimeout(GUARD_WAIT);
    await look('정답과 모둠 버튼');
  },
  story: async (page, look) => {
    for (let s = 1; s <= 5; s++) {
      for (const name of ['hint', 'ideas']) if (await page.locator(act(name)).count()) await click(page, name);
      await look(`단계 ${s} 힌트·예시`);
      if (s < 5) {
        await click(page, 'stage-next');
        await page.waitForTimeout(GUARD_WAIT);
      }
    }
  },
  draw: async (page, look) => {
    await click(page, 'draw-start');
    await page.waitForTimeout(GUARD_WAIT);
    await look('단계');
    const total = Number(await page.locator('[data-draw-step]').getAttribute('data-total-steps'));
    for (let k = 1; k <= total; k++) {
      await click(page, 'draw-next');
      await page.waitForTimeout(GUARD_WAIT);
    }
    await look('색칠');
    const coloring = Number(await page.locator('[data-coloring]').getAttribute('data-coloring'));
    await page.clock.fastForward(coloring * 1000 + 1000);
    await page.locator('[data-decorate]').waitFor();
    await look('꾸미기');
  },
};

/** 세트의 모든 순서를 돌며 규칙 화면·활동 화면·활동 안의 붐비는 화면이 넘치는지 본다(page.clock.install 뒤에 부른다) */
export async function sweepScreens(page, base, { grade, flow, teams }) {
  const over = [];
  await page.goto(base);
  await click(page, `grade-${grade}`);
  await click(page, `flow-${flow}`);
  await click(page, `teams-${teams}`);
  await click(page, 'start');
  // 별판: 모둠마다 별을 12개씩(두 자리 수) 준 뒤 칩이 한 줄이고 칩 안 글자가 잘리지 않는지
  for (let t = 0; t < teams; t++) for (let k = 0; k < 12; k++) await click(page, `star-add-${t}`);
  const chipRows = new Set(await page.locator('.team').evaluateAll((els) => els.map((e) => e.offsetTop))).size;
  const chipsClipped = await page.locator('.team-add').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  const count = await page.locator('[data-act^="goto-"]').count();
  for (let i = 0; i < count; i++) {
    const kind = await page.locator(act(`goto-${i}`)).getAttribute('data-step-kind');
    const look = async (name) => {
      const bad = await overflowOf(page);
      if (bad) over.push(`g${grade}-${flow} ${i + 1}.${kind} ${name} (${bad})`);
    };
    await page.locator(act('start-step')).waitFor();
    await look('규칙');
    await click(page, 'start-step');
    await page.waitForTimeout(GUARD_WAIT);
    await look('처음');
    if (SWEEP[kind]) await SWEEP[kind](page, look);
    if (i < count - 1) {
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'next-step');
    }
  }
  return { over, chipRows, chipsClipped };
}

// ---------------------------------------------------------------------------

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✔' : '✖'} ${name}${ok ? '' : `  — ${detail}`}`);
}

async function main() {
  const server = await startServer(0);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

    // 첫 화면: 학년 고르기 전에는 [시작] 꺼짐
    {
      const page = await ctx.newPage();
      await page.goto(base);
      check('학년 고르기 전 [시작] 꺼짐', await page.locator(act('start')).isDisabled());
      await click(page, 'grade-2');
      check('학년 고르면 [시작] 켜짐', await page.locator(act('start')).isEnabled());
      check('출처 표시', (await page.locator('body').innerText()).includes('문항·이야기·그림: 짬짬이'));
      await page.close();
    }

    // 12세트 모두 끝까지(모둠 6개): 콘솔 오류 0, 축하 화면 합계 = 진행 중 준 별 수
    for (const s of SETS) {
      const page = await ctx.newPage();
      const { errors, given } = await runSet(page, { grade: s.grade, flow: s.flow, teams: 6 }, base);
      check(`${s.id} 끝까지 진행, 콘솔 오류 0`, errors.length === 0, errors.join(' | '));
      const shown = Number(await page.locator('[data-celebrate-total]').getAttribute('data-celebrate-total'));
      check(`${s.id} 축하 화면 합계 = 준 별 ${given}`, given > 0 && shown === given && (await totalStars(page)) === given, `축하 ${shown}, 별판 ${await totalStars(page)}`);
      await page.close();
    }

    // 규칙 안내 본문 글자: 1920×1080 에서 32px 이상(교실 뒷자리)
    {
      const page = await ctx.newPage();
      await page.goto(base);
      await click(page, 'grade-6');
      await click(page, 'start');
      const px = await page.locator('.rules-lines li').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      check('규칙 안내 본문 글자 32px 이상(1920×1080)', px >= 32, `${px}px`);
      await page.close();
    }

    // 작은 화면(1366×768, 1280×720)에서 g6-lively 모둠 8개: 모든 화면이 넘치지 않고 별판이 한 줄
    for (const [width, height] of [[1366, 768], [1280, 720]]) {
      const sctx = await browser.newContext({ viewport: { width, height } });
      try {
        const page = await sctx.newPage();
        await page.clock.install();
        // g6-lively(상식 퀴즈) + g6-calm(몸으로 말해요): 두 세트면 활동 7가지가 모두 지나간다
        for (const flow of ['lively', 'calm']) {
          const { over, chipRows, chipsClipped } = await sweepScreens(page, base, { grade: 6, flow, teams: 8 });
          check(`${width}×${height} g6-${flow}: 모든 화면이 화면 안에 들어감`, over.length === 0, over.join(' | '));
          check(`${width}×${height} g6-${flow}: 모둠 8개 별판이 한 줄, 칩 글자(★12) 안 잘림`, chipRows === 1 && chipsClipped === 0, `${chipRows}줄, 잘린 칩 ${chipsClipped}개`);
        }
      } finally {
        await sctx.close();
      }
    }

    // 순서 알약·일시정지
    {
      const page = await ctx.newPage();
      await page.goto(base);
      await click(page, 'grade-3');
      await click(page, 'start');
      const title = (await page.locator(act('goto-3')).innerText()).replace(/^\S+\s*/, '').trim();
      await click(page, 'goto-3');
      const rules = page.locator('[data-view="rules"]');
      check('알약 4번째 → 그 순서의 규칙 안내', (await rules.isVisible()) && (await rules.innerText()).includes(title), title);
      await click(page, 'start-step');
      await page.waitForTimeout(600);
      await click(page, 'pause');
      const before = await page.locator('[data-remain]').innerText();
      await page.waitForTimeout(2000);
      const after = await page.locator('[data-remain]').innerText();
      check('⏸ 뒤 2초 동안 남은 시간 그대로', before === after, `${before} → ${after}`);
      await page.close();
    }

    // 말놀이 (Task 7)
    {
      const page = await ctx.newPage();
      await openStep(page, base, { grade: 3, flow: 'lively', teams: 6, kind: 'word' });
      check('말놀이: 문제 글자가 화면 안에 다 보임', await inViewport(page, '[data-prompt]'));
      const t0 = await totalStars(page);
      await page.locator(act('correct')).dblclick();
      await page.waitForTimeout(100);
      check('말놀이: [맞혔어요] 두 번 눌러도 별 +1', (await totalStars(page)) === t0 + 1, `${t0} → ${await totalStars(page)}`);
      await page.waitForTimeout(2600); // 정답 2초 보여 준 뒤 다음 문제
      await page.locator(act('pass')).waitFor();
      const startTurn = await page.locator('[data-turn]').getAttribute('data-turn');
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(GUARD_WAIT);
        await click(page, 'pass');
      }
      const answerShown = await page.locator('[data-answer]').isVisible();
      const onlyNext = (await page.locator(act('next-item')).isVisible())
        && (await page.locator(act('correct')).count()) === 0
        && (await page.locator(act('pass')).count()) === 0;
      check('말놀이: 모둠 수만큼 넘기면 정답과 [다음 문제]만', answerShown && onlyNext);
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'next-item');
      const nextTurn = await page.locator('[data-turn]').getAttribute('data-turn');
      check('말놀이: 아무도 못 맞힌 다음 문제는 다음 모둠 차례', Number(nextTurn) === (Number(startTurn) + 1) % 6, `${startTurn} → ${nextTurn}`);
      await click(page, 'pause');
      const d1 = await page.locator('[data-discuss]').getAttribute('data-discuss');
      await page.waitForTimeout(1500);
      const d2 = await page.locator('[data-discuss]').getAttribute('data-discuss');
      check('말놀이: ⏸ 동안 의논 시간이 줄지 않음', d1 === d2, `${d1} → ${d2}`);
      await click(page, 'pause');
      await page.waitForTimeout(1300);
      const d3 = await page.locator('[data-discuss]').getAttribute('data-discuss');
      check('말놀이: ▶ 다시 누르면 의논 시간이 줄어듦', Number(d3) < Number(d2), `${d2} → ${d3}`);
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'reveal');
      await page.waitForTimeout(GUARD_WAIT);
      const t1 = await totalStars(page);
      await page.locator(act('next-item')).dblclick();
      await page.waitForTimeout(100);
      check('말놀이: [다음 문제] 두 번 눌러도 별이 들어가지 않음', (await totalStars(page)) === t1, `${t1} → ${await totalStars(page)}`);
      await page.close();
    }

    // 이야기 나누기 (Task 9)
    {
      const page = await ctx.newPage();
      await openStep(page, base, { grade: 3, flow: 'lively', teams: 6, kind: 'story' });
      const first = (await page.locator('[data-sentence]').first().innerText()).trim();
      check('이야기: 처음 화면에 이야기 첫 문장', first.length > 0 && (await page.locator('[data-sentence]').first().isVisible()));
      for (let i = 0; i < 4; i++) {
        await click(page, 'stage-next');
        await page.waitForTimeout(GUARD_WAIT);
      }
      check('이야기: [다음 단계] 4번 → 생각 넓히기', (await page.locator('[data-stage]').innerText()).includes('생각 넓히기'));
      await click(page, 'stage-prev');
      await page.waitForTimeout(GUARD_WAIT);
      check('이야기: [이전 단계] → 발표하기', (await page.locator('[data-stage]').innerText()).includes('발표하기'));
      await page.locator('[data-field="class-size"]').fill('3');
      await page.waitForTimeout(1300); // 시간이 흐르며 화면이 다시 그려져도
      check('이야기: 입력한 반 인원이 시간이 지나도 그대로', (await page.locator('[data-field="class-size"]').inputValue()) === '3');
      const picks = [];
      for (let i = 0; i < 4; i++) {
        await click(page, 'pick-number');
        await page.waitForTimeout(GUARD_WAIT);
        picks.push(Number(await page.locator('[data-picked]').getAttribute('data-picked')));
      }
      const firstThree = new Set(picks.slice(0, 3));
      check('이야기: 반 인원 3명 → 앞의 3번은 서로 다른 번호', firstThree.size === 3 && picks.every((n) => n >= 1 && n <= 3), picks.join(','));
      const t0 = await totalStars(page);
      await page.locator(act('award-all')).dblclick();
      await page.waitForTimeout(100);
      check('이야기: [모두 ★] 두 번 눌러도 모둠 수만큼 한 번', (await totalStars(page)) === t0 + 6, `${t0} → ${await totalStars(page)}`);
      await page.close();
    }

    // 따라 그리기와 꾸미기 (Task 10) — 가짜 시계로 시간을 건너뛴다
    {
      const page = await ctx.newPage();
      await page.clock.install();
      await openStep(page, base, { grade: 3, flow: 'calm', teams: 6, kind: 'draw' });
      check('그리기: 준비 화면에 준비 안내', (await page.locator('[data-setup]').innerText()).trim().length > 0);
      await click(page, 'draw-start');
      await page.waitForTimeout(GUARD_WAIT);
      const total = Number(await page.locator('[data-draw-step]').getAttribute('data-total-steps'));
      const k0 = await page.locator('[data-draw-step]').getAttribute('data-draw-step');
      await click(page, 'pause');
      await page.clock.fastForward(30000);
      const k1 = await page.locator('[data-draw-step]').getAttribute('data-draw-step');
      check('그리기: ⏸ 동안 30초가 지나도 단계 그대로', k0 === k1 && k0 === '1', `${k0} → ${k1}`);
      await click(page, 'pause');
      await page.clock.fastForward(40000);
      const k2 = Number(await page.locator('[data-draw-step]').getAttribute('data-draw-step'));
      check('그리기: ▶ 뒤 시간이 지나면 다음 단계로 저절로', k2 > 1, String(k2));
      for (let i = k2; i <= total; i++) {
        await click(page, 'draw-next');
        await page.waitForTimeout(GUARD_WAIT);
      }
      check('그리기: [다음]을 끝까지 → 색칠 화면', await page.locator('[data-coloring]').isVisible());
      const coloring = Number(await page.locator('[data-coloring]').getAttribute('data-coloring'));
      await page.clock.fastForward(coloring * 1000 + 1000);
      const deco = page.locator('[data-decorate]');
      const text = (await deco.innerText()).trim();
      check('그리기: 색칠이 끝나면 꾸미기 문구, {title} 없음', (await deco.isVisible()) && text.length > 0 && !text.includes('{title}'), text);
      await page.waitForTimeout(GUARD_WAIT);
      const t0 = await totalStars(page);
      await page.locator(act('award-all')).dblclick();
      await page.waitForTimeout(100);
      check('그리기: [모두 ★] 두 번 눌러도 한 번', (await totalStars(page)) === t0 + 6);
      await page.close();
    }

    // [▶ 시작] 두 번 누름이 활동 버튼에 닿지 않음
    {
      const page = await ctx.newPage();
      await page.goto(base);
      await click(page, 'grade-3');
      await click(page, 'start');
      await page.locator('[data-step-kind="word"]').click();
      await page.locator(act('start-step')).dblclick();
      await page.waitForTimeout(100);
      check('[▶ 시작] 두 번 눌러도 별이 들어가지 않음', (await totalStars(page)) === 0, String(await totalStars(page)));
      await page.close();
    }

    // 몸으로 말해요 (Task 8)
    {
      const page = await ctx.newPage();
      await openStep(page, base, { grade: 3, flow: 'lively', teams: 6, kind: 'gesture' });
      const before = await page.locator('[data-kind="gesture"]').innerHTML();
      const hiddenFirst = (await page.locator('[data-word]').count()) === 0;
      const t00 = await totalStars(page);
      await page.locator(act('show-word')).dblclick();
      await page.waitForTimeout(100);
      check('몸으로 말해요: [낱말 보이기] 두 번 눌러도 별이 들어가지 않음', (await totalStars(page)) === t00);
      const word = (await page.locator('[data-word]').innerText()).trim();
      check('몸으로 말해요: 준비 화면에는 낱말이 없음', hiddenFirst && word.length > 0 && !before.includes(word), word);
      await page.waitForTimeout(GUARD_WAIT);
      const t0 = await totalStars(page);
      await page.locator(act('correct')).dblclick();
      await page.waitForTimeout(100);
      check('몸으로 말해요: [맞혔어요] 두 번 눌러도 별 +1', (await totalStars(page)) === t0 + 1);
      check('몸으로 말해요: 맞히면 다음 모둠 준비 화면', (await page.locator(act('show-word')).isVisible()) && (await page.locator('[data-word]').count()) === 0);
      await page.close();
    }

    // 상식 퀴즈 판 (Task 8)
    {
      const page = await ctx.newPage();
      await openStep(page, base, { grade: 3, flow: 'calm', teams: 6, kind: 'quizboard' });
      check('상식 퀴즈: 보기 4개', (await page.locator('[data-option]').count()) === 4);
      check('상식 퀴즈: 차례 강조 없음', (await page.locator('.team.turn').count()) === 0);
      const t0 = await totalStars(page);
      await page.locator(act('reveal')).dblclick();
      await page.waitForTimeout(100);
      const stray = await page.locator('[data-act^="team-toggle-"][aria-pressed="true"]').count();
      check('상식 퀴즈: [정답 보기] 두 번 눌러도 모둠 버튼이 켜지지 않음', stray === 0, String(stray));
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'team-toggle-1');
      await click(page, 'team-toggle-3');
      await page.locator(act('award-and-next')).dblclick();
      await page.waitForTimeout(100);
      check('상식 퀴즈: 두 모둠 켜고 [별 주고 다음 문제] → +2', (await totalStars(page)) === t0 + 2, `${t0} → ${await totalStars(page)}`);
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'reveal');
      await page.waitForTimeout(GUARD_WAIT);
      const pressed = await page.locator('[data-act^="team-toggle-"][aria-pressed="true"]').count();
      check('상식 퀴즈: 다음 문제의 모둠 버튼은 모두 꺼짐', pressed === 0, String(pressed));
      await click(page, 'all-correct');
      const allOn = await page.locator('[data-act^="team-toggle-"][aria-pressed="true"]').count();
      check('상식 퀴즈: [모두 맞혔어요] → 모두 켜짐', allOn === 6, String(allOn));
      await page.close();
    }

    // 진행 대본: 12세트 모두 A4 한 장
    {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      for (const s of SETS) {
        await page.goto(`${base}print.html?grade=${s.grade}&flow=${s.flow}`);
        await page.locator('body[data-ready]').waitFor();
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: PRINT_MARGIN });
        const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
        check(`진행 대본 ${s.id}: A4 한 장`, pages === 1, `${pages}장`);
      }
      const text = await page.locator('body').innerText();
      check('진행 대본: 별 세는 법(바를 정 자)이 있음', text.includes('바를 정 자'));
      await page.emulateMedia({ media: 'print' });
      check('진행 대본: 인쇄할 때 [인쇄] 버튼은 숨김', await page.locator(act('print-now')).isHidden());
      check('진행 대본: 콘솔 오류 0', errors.length === 0, errors.join(' | '));
      await page.close();
    }

    // 인터넷이 끊겨도: 한 번 연 뒤 오프라인으로 다시 열기
    {
      const octx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      try {
        const first = await octx.newPage();
        await first.goto(base);
        await first.evaluate(() => navigator.serviceWorker.ready.then(() => true));
        await first.close();
        await octx.setOffline(true);
        const page = await octx.newPage();
        await page.goto(base);
        check('오프라인: 첫 화면이 뜸', await page.locator(act('grade-1')).isVisible());
        await click(page, 'grade-1');
        await click(page, 'flow-lively');
        await click(page, 'start');
        await click(page, 'start-step');
        const firstKind = await page.locator('[data-kind]').first().getAttribute('data-kind');
        check('오프라인: g1-lively 첫 순서가 뜸', firstKind === 'greet', String(firstKind));
        await page.goto(`${base}print.html?grade=1&flow=lively`);
        await page.locator('body[data-ready]').waitFor();
        check('오프라인: 진행 대본도 열림', (await page.locator('body').innerText()).includes('바를 정 자'));
      } finally {
        await octx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} 통과`);
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
