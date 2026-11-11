// 브라우저 검사(Playwright). 서버를 띄우고 실제 화면을 마우스로 눌러 본다.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';

const GUARD_WAIT = 450; // 두 번 눌림 막기(400ms)보다 조금 길게

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

    // 두 세트를 끝까지
    for (const [grade, flow] of [[3, 'lively'], [4, 'calm']]) {
      const page = await ctx.newPage();
      const { errors } = await runSet(page, { grade, flow, teams: 6 }, base);
      check(`g${grade}-${flow} 끝까지 진행, 콘솔 오류 0`, errors.length === 0, errors.join(' | '));
      check(`g${grade}-${flow} 축하 화면`, (await page.locator('body').innerText()).includes('오늘 우리 반 별'));
      await page.close();
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
