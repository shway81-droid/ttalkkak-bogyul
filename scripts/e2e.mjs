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
