// 단일 HTML 파일(dist/딸깍보결.html)을 file:// 로 열어 확인한다 — 선생님이 받은 파일을 더블클릭한 것과 같다.
// 수업 시작 → 인물 사진 → 선생님용 정답 창(postMessage) → 진행 대본 → 사진 출처, 콘솔 오류 0.
// e2e.mjs 가 부르고, 따로 돌릴 수도 있다(npm run single 뒤 node scripts/check-single.mjs).
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { OUT_FILE } from './build-single.mjs';

const act = (n) => `[data-act="${n}"]`;
const WAIT = 450;

export async function checkSingle(browser, check, file = OUT_FILE) {
  const url = pathToFileURL(file).href;
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  const watch = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('dialog', (d) => d.accept().catch(() => {}));
  };
  ctx.on('page', watch);
  try {
    const page = await ctx.newPage();
    await page.goto(url);
    const shown = await page.locator(act('grade-5')).waitFor({ timeout: 5000 }).then(() => true, () => false);
    check('단일 파일: 파일로 열면 첫 화면이 뜸', shown);
    await page.locator(act('grade-5')).click();
    await page.locator(act('start')).click();
    await page.locator('[data-kind="greet"]').waitFor();
    check('단일 파일: 수업이 시작되고 인사가 바로 뜸', true);

    // 선생님용 정답 창: 수업 화면이 연 창으로 postMessage(file:// 에서는 BroadcastChannel 이 안 됨)
    const [answer] = await Promise.all([ctx.waitForEvent('page'), page.locator(act('answer-window')).click()]);
    await answer.waitForLoadState();
    await page.locator('[data-step-kind="person"]').click();
    await page.locator(act('start-step')).click();
    await page.locator('[data-photo]').waitFor();
    await page.waitForTimeout(WAIT);
    const photoOk = await page.locator('[data-photo]').evaluate((img) => img.complete && img.naturalWidth > 0);
    check('단일 파일: 인물 사진이 뜸', photoOk);
    await page.locator(act('reveal')).click();
    await page.waitForTimeout(WAIT);
    const name = (await page.locator('.word-answer-main strong').innerText()).trim();
    const live = (await answer.locator('[data-answer]').innerText({ timeout: 3000 }).catch(() => '')).trim();
    check('단일 파일: 정답 창에 지금 인물의 이름이 뜸', live === name && name.length > 0, `${live} / ${name}`);
    const livePhoto = await answer.locator('.photo').evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
    check('단일 파일: 정답 창에 인물 사진도 뜸', livePhoto);

    // 진행 대본(#print)
    const print = await ctx.newPage();
    await print.goto(`${url}#print?grade=3&flow=lively`);
    await print.locator('body[data-ready]').waitFor({ timeout: 10000 });
    const sheet = await print.locator('#sheet').innerText();
    check('단일 파일: 진행 대본이 열림', sheet.includes('딸깍 보결 진행 대본') && sheet.includes('바를 정 자'));

    // 사진 출처(#credits)
    const credits = await ctx.newPage();
    await credits.goto(`${url}#credits`);
    await credits.locator('body[data-credits-ready]').waitFor({ timeout: 10000 });
    const rows = await credits.locator('[data-credit-row]').count();
    check('단일 파일: 사진 출처 목록이 모두 뜸', rows >= 200, `${rows}줄`);

    check('단일 파일: 콘솔 오류 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await ctx.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch();
  let bad = 0;
  await checkSingle(browser, (name, ok, detail = '') => {
    if (!ok) bad += 1;
    console.log(`${ok ? '✔' : '✖'} ${name}${!ok && detail ? `  — ${detail}` : ''}`);
  });
  await browser.close();
  process.exit(bad ? 1 : 0);
}
