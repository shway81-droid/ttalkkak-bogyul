// 소개 영상에 쓸 실제 앱 화면을 찍는다(1920×1080, 2배 선명도) → video/public/shots/*.png
// 강조 상자를 그릴 단추 위치는 video/public/shots/boxes.json 에 1920×1080 기준 px 로 남긴다.
// 유튜브에 공개되는 영상이므로 인물 퀴즈 사진은 흐리게 찍는다.
//
//   저장소 맨 위에서:  node video/scripts/capture.mjs
//   (Playwright 브라우저가 다른 곳에 있으면 CHROME_PATH=/경로/chrome 을 함께)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'shots');
mkdirSync(OUT, { recursive: true });

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const boxes = {};

const act = (n) => `[data-act="${n}"]`;
const wait = (p, ms = 500) => p.waitForTimeout(ms);
const BLUR = '.person-photo { filter: blur(28px) saturate(0.7); }';

async function box(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}

async function home(page, { grade = 3, teams = 6 } = {}) {
  await page.goto(base);
  await page.addStyleTag({ content: BLUR });
  await page.locator(act(`grade-${grade}`)).click();
  await page.locator(act(`teams-${teams}`)).click();
}

async function toStep(page, kind) {
  await page.locator(`[data-step-kind="${kind}"]`).first().click();
  await page.locator('[data-view="rules"], [data-view="activity"]').first().waitFor();
}

// 1) 첫 화면 + 단추 위치
{
  const page = await ctx.newPage();
  await home(page);
  await wait(page);
  boxes.start = {
    grade: await box(page, '.pick-row:nth-of-type(1) .chips'),
    flow: await box(page, '.flows'),
    teams: await box(page, '.pick-row:nth-of-type(3) .chips'),
    answer: await box(page, act('open-answer')),
    go: await box(page, act('start')),
  };
  await page.screenshot({ path: join(OUT, 'start.png') });
  await page.close();
}

// 2) 수업 화면들
{
  const page = await ctx.newPage();
  await home(page);
  await page.locator(act('start')).click();
  await page.locator('.strip').waitFor();

  // 별판에 별을 조금 채워 둔다(17/36)
  const stars = [3, 2, 4, 3, 2, 3];
  for (let t = 0; t < stars.length; t++) for (let i = 0; i < stars[t]; i++) {
    await page.locator(act(`star-add-${t}`)).click();
    await wait(page, 430);
  }

  // 규칙 안내(인물 퀴즈)
  await toStep(page, 'person');
  await wait(page);
  boxes.rules = { answer: await box(page, act('rules-answer-window')), go: await box(page, act('start-step')) };
  await page.screenshot({ path: join(OUT, 'rules.png') });

  // 인물 퀴즈(사진 흐리게) + 정답 창
  const answer = await ctx.newPage();
  await answer.setViewportSize({ width: 560, height: 860 });
  await answer.goto(`${base}answer.html`);
  await answer.addStyleTag({ content: '.answer-photo img, img { filter: blur(22px) saturate(0.7); }' });
  await page.bringToFront();
  await page.locator(act('start-step')).click();
  await page.locator('[data-kind="person"]').waitFor();
  await wait(page, 900);
  boxes.board = await box(page, '.board');
  boxes.strip = { answer: await box(page, act('answer-window')) };
  await page.screenshot({ path: join(OUT, 'person.png') });
  await wait(answer, 600);
  await answer.screenshot({ path: join(OUT, 'answer-person.png') });

  // 몸으로 말해요(모둠 놀이)
  await toStep(page, 'gesture');
  await page.locator(act('start-step')).click();
  await page.locator('[data-kind="gesture"]').waitFor();
  await wait(page, 600);
  const go = page.locator(act('show-word'));
  if (await go.count()) { await go.click(); await wait(page, 700); }
  await page.screenshot({ path: join(OUT, 'gesture.png') });

  // 말놀이 + 정답 창
  await toStep(page, 'word');
  await page.locator(act('start-step')).click();
  await page.locator('[data-kind="word"]').waitFor();
  await wait(page, 900);
  await page.screenshot({ path: join(OUT, 'word.png') });
  await wait(answer, 600);
  await answer.screenshot({ path: join(OUT, 'answer-word.png') });

  // 이야기
  await toStep(page, 'story');
  await page.locator(act('start-step')).click();
  await page.locator('.story-read').waitFor();
  await wait(page, 900);
  await page.screenshot({ path: join(OUT, 'story.png') });

  // 축하
  await toStep(page, 'celebrate');
  await page.locator(act('start-step')).click();
  await page.locator('[data-kind="celebrate"]').waitFor();
  await wait(page, 4000);
  await page.screenshot({ path: join(OUT, 'celebrate.png') });
  await answer.close();
  await page.close();
}

writeFileSync(join(OUT, 'boxes.json'), JSON.stringify(boxes, null, 2));
await browser.close();
server.close();
console.log('찍음:', OUT);
console.log(JSON.stringify(boxes));
