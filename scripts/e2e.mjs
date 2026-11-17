// 브라우저 검사(Playwright). 서버를 띄우고 실제 화면을 마우스로 눌러 본다.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';
import { buildSingle } from './build-single.mjs';
import { checkSingle } from './check-single.mjs';

const GUARD_WAIT = 450; // 두 번 눌림 막기(400ms)보다 조금 길게
const SETS = JSON.parse(readFileSync(new URL('../data/sets.json', import.meta.url), 'utf8')).sets;
// 브라우저 기본 여백(약 10mm)보다 조금 넓게 잡아도 한 장에 들어가야 한다.
const PRINT_MARGIN = { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' };

const act = (name) => `[data-act="${name}"]`;

const leaveOk = new WeakSet();

// 가끔 한 번 멈추는 문제(첫 화면이 30초 안에 안 뜸, 원인 모름)를 다시 만나면 원인을 볼 수 있게
// 페이지마다 콘솔 오류·실패한 요청·서비스 워커 상태를 최근 80줄까지 모아 두고, 검사가 예외로 멈추면 찍는다.
const trail = [];
function note(line) {
  trail.push(`${new Date().toISOString().slice(11, 23)} ${line}`);
  if (trail.length > 80) trail.shift();
}
const traced = new WeakSet();
function trace(page) {
  if (traced.has(page)) return;
  traced.add(page);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') note(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => note(`[pageerror] ${e}`));
  page.on('requestfailed', (r) => note(`[requestfailed] ${r.url()} ${r.failure()?.errorText || ''}`));
  page.on('response', (r) => { if (r.status() >= 400) note(`[http ${r.status()}] ${r.url()}`); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) note(`[navigated] ${f.url()}`); });
}
/**
 * 페이지를 연다. 수업 중인 페이지에서 옮기면 브라우저가 '사이트에서 나가시겠습니까?'를 묻는데(의도된 동작),
 * 검사에서는 '나가기'를 고른다. (떠나기 확인 자체는 LIVE_CHECKS.leaveGuard 가 따로 본다)
 */
export async function open(page, url) {
  trace(page);
  note(`[open] ${url}`);
  if (!leaveOk.has(page)) {
    leaveOk.add(page);
    page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()).catch(() => {}));
  }
  await page.goto(url);
}

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

ACT_STEPS.person = ACT_STEPS.word;

/** 규칙 안내가 나오면 [시작]을 누른다. 인사는 규칙 안내 없이 바로 활동이 열린다. 규칙 화면이었으면 true */
export async function startIfRules(page) {
  await page.locator('[data-view="rules"], [data-view="activity"]').first().waitFor();
  if (!(await page.locator('[data-view="rules"]').count())) return false;
  await click(page, 'start-step');
  return true;
}

/** 세트를 열고 kind 순서의 활동 화면까지 바로 간다 */
export async function openStep(page, base, { grade, flow = 'lively', teams = 6, kind }) {
  await open(page, base);
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
  await open(page, base);
  await click(page, `grade-${grade}`);
  await click(page, `flow-${flow}`);
  await click(page, `teams-${teams}`);
  await click(page, 'start');
  let given = 0;
  const count = await page.locator('[data-act^="goto-"]').count();
  for (let i = 0; i < count; i++) {
    await startIfRules(page);
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
};
SWEEP.person = SWEEP.word; // 힌트 → 정답(이름·사진 출처)까지

/** 세트의 모든 순서를 돌며 규칙 화면·활동 화면·활동 안의 붐비는 화면이 넘치는지 본다(page.clock.install 뒤에 부른다) */
export async function sweepScreens(page, base, { grade, flow, teams }) {
  const over = [];
  await open(page, base);
  await click(page, `grade-${grade}`);
  await click(page, `flow-${flow}`);
  await click(page, `teams-${teams}`);
  await click(page, 'start');
  // 별판: 모둠마다 별을 12개씩(두 자리 수) 준 뒤 칩이 한 줄이고 칩 안 글자가 잘리지 않는지
  // (같은 모둠 칩은 400ms 안에 다시 누르면 무시되므로 모둠을 돌아가며 누른다)
  for (let k = 0; k < 12; k++) {
    for (let t = 0; t < teams; t++) await click(page, `star-add-${t}`);
    await page.waitForTimeout(GUARD_WAIT);
  }
  const chipStars = await page.locator('[data-total]').getAttribute('data-total');
  if (Number(chipStars) !== teams * 12) over.push(`별판 별 ${chipStars}개(기대 ${teams * 12})`);
  const chipRows = new Set(await page.locator('.team').evaluateAll((els) => els.map((e) => e.offsetTop))).size;
  const chipsClipped = await page.locator('.team-add').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  const count = await page.locator('[data-act^="goto-"]').count();
  for (let i = 0; i < count; i++) {
    const kind = await page.locator(act(`goto-${i}`)).getAttribute('data-step-kind');
    const look = async (name) => {
      const bad = await overflowOf(page);
      if (bad) over.push(`g${grade}-${flow} ${i + 1}.${kind} ${name} (${bad})`);
    };
    await page.locator('[data-view="rules"], [data-view="activity"]').first().waitFor();
    if (await page.locator('[data-view="rules"]').count()) {
      await look('규칙');
      await click(page, 'start-step');
    }
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

/** 누르고 있는 동안(1.1초) 화면의 1초 카운트다운이 바뀌는 느린 클릭 */
async function slowClick(page, name, holdMs = 1100) {
  const box = await page.locator(act(name)).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

/** 수업 중 조작 검사(최종 검토에서 나온 것). 각각 (ctx, base, check) 를 받는다. */
export const LIVE_CHECKS = {
  // 카운트다운이 화면 전체를 다시 그리면 누르는 사이 버튼이 바뀌어 클릭이 사라진다
  async slowClicks(ctx, base, check) {
    const page = await ctx.newPage();
    await openStep(page, base, { grade: 2, flow: 'lively', teams: 6, kind: 'word' });
    let t0 = await totalStars(page);
    await slowClick(page, 'correct');
    check('말놀이: 의논 시간이 줄어드는 동안 천천히 누른 [맞혔어요]도 들어감', (await totalStars(page)) === t0 + 1, `${t0} → ${await totalStars(page)}`);
    await openStep(page, base, { grade: 1, flow: 'lively', teams: 6, kind: 'gesture' });
    await click(page, 'show-word');
    await page.waitForTimeout(GUARD_WAIT);
    t0 = await totalStars(page);
    await slowClick(page, 'correct');
    check('몸으로 말해요: 남은 시간이 줄어드는 동안 천천히 누른 [맞혔어요]도 들어감', (await totalStars(page)) === t0 + 1, `${t0} → ${await totalStars(page)}`);
    await openStep(page, base, { grade: 1, flow: 'calm', teams: 6, kind: 'quizboard' });
    await slowClick(page, 'reveal');
    check('상식 퀴즈: 의논 시간이 줄어드는 동안 천천히 누른 [정답 보기]도 들어감', await page.locator(act('team-toggle-0')).isVisible());
    await page.close();
  },

  // 축하 순서에서는 모둠별 별을 나란히 보여 주지 않는다(우리 반 합계만)
  async celebrateNoTeams(ctx, base, check) {
    const page = await ctx.newPage();
    await open(page, base);
    await click(page, 'grade-3');
    await click(page, 'start');
    const last = (await page.locator('[data-act^="goto-"]').count()) - 1;
    await click(page, `goto-${last}`);
    const rulesTeams = await page.locator('.team').count();
    check('축하 규칙 안내에는 정답 창 단추가 없음(정답이 없는 순서)', (await page.locator(act('rules-answer-window')).count()) === 0);
    await click(page, 'start-step');
    await page.locator('[data-kind="celebrate"]').waitFor();
    const actTeams = await page.locator('.team').count();
    check('축하: 규칙·활동 화면 모두 모둠별 별 칩 없이 우리 반 합계만', rulesTeams === 0 && actTeams === 0 && (await page.locator('[data-total]').isVisible()), `규칙 ${rulesTeams}, 활동 ${actTeams}`);
    await click(page, 'goto-1');
    check('축하에서 앞 순서로 가면 모둠 칩이 다시 보임', (await page.locator('.team').count()) === 6);
    await page.close();
  },

  // 별을 바꾸는 버튼은 두 번 눌러도 한 번만
  async doubleClicks(ctx, base, check) {
    const page = await ctx.newPage();
    await open(page, base);
    await click(page, 'grade-3');
    await click(page, 'start');
    await page.locator(act('star-add-2')).dblclick();
    await page.waitForTimeout(100);
    check('별판: 모둠 칩을 두 번 눌러도 별 +1', (await totalStars(page)) === 1, String(await totalStars(page)));
    await page.waitForTimeout(GUARD_WAIT);
    await click(page, 'star-add-2');
    await page.waitForTimeout(GUARD_WAIT);
    const t1 = await totalStars(page);
    await page.locator(act('star-remove-2')).dblclick();
    await page.waitForTimeout(100);
    check('별판: [−]를 두 번 눌러도 별 −1', (await totalStars(page)) === t1 - 1, `${t1} → ${await totalStars(page)}`);
    await openStep(page, base, { grade: 1, flow: 'calm', teams: 6, kind: 'quizboard' });
    await click(page, 'reveal');
    await page.waitForTimeout(GUARD_WAIT);
    await page.locator(act('team-toggle-1')).dblclick();
    await page.waitForTimeout(100);
    check('상식 퀴즈: 모둠 버튼을 두 번 눌러도 켜진 채', (await page.locator(act('team-toggle-1')).getAttribute('aria-pressed')) === 'true');
    await page.close();
  },

  // 수업 중에 새로고침·뒤로 가기를 누르면 한 번 묻는다(별과 진행이 사라지므로). 첫 화면에서는 묻지 않는다.
  async leaveGuard(ctx, base, check) {
    const page = await ctx.newPage();
    const dialogs = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.type());
      await d.dismiss();
    });
    await page.goto(base);
    await click(page, 'grade-3');
    await click(page, 'start');
    await page.close({ runBeforeUnload: true });
    await new Promise((r) => setTimeout(r, 500));
    check('수업 중 페이지를 떠나려 하면 묻고, 머무르면 그대로', dialogs.includes('beforeunload') && !page.isClosed(), `물음 [${dialogs.join(',')}], 닫힘 ${page.isClosed()}`);
    if (page.isClosed()) return;
    await click(page, 'exit');
    await click(page, 'exit-confirm');
    await page.locator(act('grade-1')).waitFor();
    const before = dialogs.length;
    const closed = new Promise((r) => page.once('close', () => r(true)));
    await page.close({ runBeforeUnload: true });
    const ok = await Promise.race([closed, new Promise((r) => setTimeout(() => r(false), 3000))]);
    check('수업을 끝낸 뒤 첫 화면에서는 묻지 않음', ok && dialogs.length === before, `닫힘 ${ok}, 물음 ${dialogs.length - before}`);
  },
};

/** 사진이 다 읽힐 때까지 기다린 뒤 실제 크기(0이면 깨진 사진) */
const photoWidth = (locator) => locator.evaluate((img) => (img.complete
  ? img.naturalWidth
  : new Promise((r) => { img.addEventListener('load', () => r(img.naturalWidth)); img.addEventListener('error', () => r(0)); })));

/** 인물 퀴즈 화면과 사진 출처 페이지 */
export async function checkPerson(ctx, base, check) {
  const page = await ctx.newPage();
  await openStep(page, base, { grade: 1, flow: 'lively', teams: 6, kind: 'person' });
  const photo = page.locator('[data-photo]');
  check('인물 퀴즈: 사진이 실제로 뜸', (await photoWidth(photo)) > 0, String(await photo.getAttribute('src')));
  check('인물 퀴즈: 사진 alt 가 비어 있음(화면 읽기가 정답을 말하지 않게)', (await photo.getAttribute('alt')) === '');
  check('인물 퀴즈: 사진이 화면 안에 다 보임', await inViewport(page, '[data-photo]'));
  check('인물 퀴즈: 묻는 동안에는 사진 출처를 보이지 않음(원본 주소에 이름이 있음)', (await page.locator('[data-credit]').count()) === 0);
  check('인물 퀴즈: 별판에 차례 모둠 표시', (await page.locator('.team.turn').count()) === 1);
  const t0 = await totalStars(page);
  await page.locator(act('correct')).dblclick();
  await page.waitForTimeout(100);
  check('인물 퀴즈: [맞혔어요] 두 번 눌러도 별 +1', (await totalStars(page)) === t0 + 1, `${t0} → ${await totalStars(page)}`);
  const credit = page.locator('[data-credit]');
  check('인물 퀴즈: 맞히면 사진 아래에 사진 출처', (await credit.isVisible()) && /^사진: .+ · .+/.test((await credit.innerText()).trim()), await credit.innerText().catch(() => ''));
  await page.waitForTimeout(2600); // 2초 보여 준 뒤 다음 인물
  await page.locator(act('reveal')).waitFor();
  const src0 = await photo.getAttribute('src');
  await page.waitForTimeout(GUARD_WAIT);
  await click(page, 'reveal');
  await page.waitForTimeout(GUARD_WAIT);
  check('인물 퀴즈: [정답 보기] → 이름과 사진 출처, 사진은 그대로', (await page.locator('[data-answer]').isVisible()) && (await credit.isVisible()) && (await photo.getAttribute('src')) === src0);
  await page.close();

  const cp = await ctx.newPage();
  await open(cp, base);
  await cp.locator(act('credits')).click();
  await cp.locator('body[data-credits-ready]').waitFor();
  const people = JSON.parse(readFileSync(new URL('../data/people.json', import.meta.url), 'utf8')).people.length;
  const rows = await cp.locator('[data-credit-row]').count();
  check(`사진 출처 페이지: 인물 ${people}명 모두`, people > 0 && rows === people, `${rows}줄`);
  const noLink = await cp.locator('[data-credit-row]').evaluateAll((els) => els.filter((r) => !/^https:\/\//.test(r.querySelector('a[data-source]')?.href || '')).length);
  check('사진 출처 페이지: 줄마다 저작자·라이선스·원본 링크', noLink === 0, `원본 링크 없는 줄 ${noLink}`);
  await cp.close();
}

/** 미뤄 둔 작은 문제(2026-11-16)를 고친 것 */
export const FIX_CHECKS = {
  // 1280×720: 가장 긴 사진 출처 줄도 잘리지 않고, 출처가 나타날 때 사진 크기가 그대로
  async creditLine(browser, base, check) {
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      const page = await sctx.newPage();
      await openStep(page, base, { grade: 5, flow: 'lively', teams: 8, kind: 'person' });
      const photo = page.locator('[data-photo]');
      await photoWidth(photo);
      const h0 = (await photo.boundingBox()).height;
      await click(page, 'reveal');
      await page.waitForTimeout(GUARD_WAIT);
      const h1 = (await photo.boundingBox()).height;
      check('1280×720 인물 퀴즈: 사진 출처가 나타나도 사진 크기 그대로', Math.abs(h1 - h0) < 1, `${h0} → ${h1}`);
      const people = JSON.parse(readFileSync(new URL('../data/people.json', import.meta.url), 'utf8')).people;
      const longest = people.map((p) => `사진: ${p.photo.license} · ${p.photo.author}`).sort((a, b) => b.length - a.length)[0];
      const clipped = await page.locator('[data-credit]').evaluate((el, text) => {
        el.textContent = text;
        return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      }, longest);
      check('1280×720 인물 퀴즈: 가장 긴 사진 출처 줄도 잘리지 않음(라이선스가 앞)', !clipped && /^사진: (CC|Public|공공|퍼블릭)/.test(longest), longest);
    } finally {
      await sctx.close();
    }
  },

  // 사진을 읽지 못하면 빈 칸 대신 알림 + 힌트가 저절로 열림
  async brokenPhoto(browser, base, check) {
    const bctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
    try {
      await bctx.route('**/assets/people/**', (r) => r.abort());
      const page = await bctx.newPage();
      await openStep(page, base, { grade: 1, flow: 'lively', teams: 6, kind: 'person' });
      const shown = await page.locator('[data-photo-broken]').waitFor({ timeout: 3000 }).then(() => true, () => false);
      check('인물 퀴즈: 사진을 못 읽으면 알림과 힌트가 저절로 열림', shown && (await page.locator('.word-hint').isVisible()) && (await page.locator(act('hint')).isDisabled()));
    } finally {
      await bctx.close();
    }
  },

  // [다음 순서] 두 번 누름 → 한 칸만, 지금 순서 알약 → 묻고 나서 처음부터
  async nextAndPill(ctx, base, check) {
    const page = await ctx.newPage();
    await open(page, base);
    await click(page, 'grade-3');
    await click(page, 'start');
    await page.waitForTimeout(GUARD_WAIT);
    await page.locator(act('next-step')).dblclick();
    await page.waitForTimeout(100);
    check('[다음 순서] 두 번 눌러도 한 칸만', (await page.locator('.pill.on').getAttribute('data-act')) === 'goto-1', await page.locator('.pill.on').getAttribute('data-act'));
    await click(page, 'goto-1');
    check('규칙 안내 중 지금 순서 알약 → 묻지 않음(이미 처음)', (await page.locator('[role="dialog"]').count()) === 0);
    await click(page, 'start-step');
    await page.waitForTimeout(GUARD_WAIT);
    await click(page, 'goto-1');
    const asked = await page.locator(act('restart-confirm')).isVisible();
    await click(page, 'restart-cancel');
    const still = (await page.locator('[data-view="activity"]').count()) === 1;
    check('진행 중 지금 순서 알약 → 묻고, [아니요]면 그대로', asked && still);
    await click(page, 'goto-1');
    await click(page, 'restart-confirm');
    check('[네, 처음부터] → 그 순서의 규칙 안내', await page.locator('[data-view="rules"]').isVisible());
    await page.close();
  },

  // ⏸ 중 [맞혔어요] → 2초 뒤 다음 문제(멈춘 채 머물지 않음)
  async pausedCorrect(ctx, base, check) {
    const page = await ctx.newPage();
    await openStep(page, base, { grade: 3, flow: 'lively', teams: 6, kind: 'word' });
    const p0 = await page.locator('[data-prompt]').innerText();
    await click(page, 'pause');
    await click(page, 'correct');
    await page.waitForTimeout(2600);
    const next = await page.locator(act('correct')).isVisible();
    check('⏸ 중 [맞혔어요] → 2초 뒤 다음 문제', next && (await page.locator('[data-prompt]').innerText()) !== p0);
    check('⏸ 중 다음 문제의 의논 시간은 멈춘 채', (await page.locator('[data-discuss]').getAttribute('data-discuss')) === '10');
    await page.close();
  },

  // 이야기: 반 인원 칸을 비워도 앞 값, [힌트] 두 번 눌러도 켜진 채
  async storyInputs(ctx, base, check) {
    const page = await ctx.newPage();
    await openStep(page, base, { grade: 3, flow: 'lively', teams: 6, kind: 'story' });
    if (await page.locator(act('hint')).count()) {
      await page.locator(act('hint')).dblclick();
      await page.waitForTimeout(100);
      check('이야기: [힌트] 두 번 눌러도 켜진 채', (await page.locator(act('hint')).getAttribute('aria-pressed')) === 'true');
    }
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'stage-next');
    }
    await page.waitForTimeout(GUARD_WAIT);
    const size = page.locator('[data-field="class-size"]');
    await size.fill('3');
    await click(page, 'pick-number');
    await page.waitForTimeout(GUARD_WAIT);
    await size.fill('');
    await click(page, 'pick-number');
    const n = Number(await page.locator('[data-picked]').getAttribute('data-picked'));
    check('이야기: 반 인원 칸을 비우면 앞 값(3명) 그대로', n >= 1 && n <= 3 && (await size.inputValue()) === '3', `${n}번, 칸 '${await size.inputValue()}'`);
    await page.close();
  },

  // 동작 줄이기 설정: 깜빡임 대신 고정 강조
  async reducedMotion(browser, base, check) {
    const rctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    try {
      const page = await rctx.newPage();
      await open(page, base);
      await click(page, 'grade-3');
      await click(page, 'start');
      const shadow = await page.locator(act('next-step')).evaluate((el) => {
        el.classList.add('blink');
        return getComputedStyle(el).boxShadow;
      });
      check('동작 줄이기: 시간이 끝난 [다음 순서]는 움직임 없이 노란 테두리', shadow && shadow !== 'none', shadow);
    } finally {
      await rctx.close();
    }
  },
};

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
      await open(page, base);
      check('학년 고르기 전 [시작] 꺼짐', await page.locator(act('start')).isDisabled());
      await click(page, 'grade-2');
      check('학년 고르면 [시작] 켜짐', await page.locator(act('start')).isEnabled());
      check('첫 화면: 진행 대본 인쇄 링크는 없음(소개 영상 링크 자리)', (await page.locator(act('print')).count()) === 0);
      // 소개 영상 링크: 유튜브 주소, 새 탭, [실시간 정답 창 열기] 왼쪽 아래(좌하단)
      const intro = page.locator(act('intro-video'));
      const introOk = (await intro.count()) === 1;
      const introHref = introOk ? await intro.getAttribute('href') : null;
      check('첫 화면: 소개 영상 링크(유튜브, 새 탭)',
        introOk && /^https:\/\/(youtu\.be|www\.youtube\.com)\//.test(introHref) && (await intro.getAttribute('target')) === '_blank', String(introHref));
      const ib = introOk ? await intro.boundingBox() : null;
      const ab = await page.locator(act('open-answer')).boundingBox();
      check('첫 화면: 소개 영상 링크는 왼쪽 아래', !!ib && !!ab && ib.x < ab.x && ib.x < 1920 * 0.25 && ib.y > 1080 * 0.6, JSON.stringify({ ib, ab }));
      check('출처 표시', (await page.locator('body').innerText()).includes('문항·이야기·인물: 짬짬이'));
      check('사진 출처 페이지 링크', (await page.locator(act('credits')).getAttribute('href')) === 'credits.html');
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

    // 3모둠: 첫 화면에서 고를 수 있고, 별판 칩 3개·별 목표 18개, 세트 끝까지 진행
    {
      const page = await ctx.newPage();
      const { errors, given } = await runSet(page, { grade: 3, flow: 'lively', teams: 3 }, base);
      check('3모둠: 끝까지 진행, 콘솔 오류 0', errors.length === 0, errors.join(' | '));
      const shown = Number(await page.locator('[data-celebrate-total]').getAttribute('data-celebrate-total'));
      check(`3모둠: 축하 화면 합계 = 준 별 ${given}`, given > 0 && shown === given, `축하 ${shown}`);
      check('3모둠: 우리 반 별 목표 18개', (await page.locator('[data-goal]').getAttribute('data-goal')) === '18');
      await click(page, 'goto-1');
      check('3모둠: 별판 칩 3개', (await page.locator('.team').count()) === 3);
      await page.close();
    }
    {
      const page = await ctx.newPage();
      await openStep(page, base, { grade: 3, flow: 'lively', teams: 3, kind: 'word' });
      for (let i = 0; i < 3; i++) {
        await click(page, 'pass');
        await page.waitForTimeout(GUARD_WAIT);
      }
      check('3모둠 말놀이: 세 모둠이 다 넘기면 정답 공개', await page.locator('[data-answer]').isVisible());
      await page.close();
    }

    // 인사는 규칙 안내 없이 바로 패널(같은 말을 두 번 읽지 않게)
    {
      const page = await ctx.newPage();
      await open(page, base);
      await click(page, 'grade-2');
      await click(page, 'start');
      await page.locator('[data-kind="greet"]').waitFor();
      check('인사: 규칙 안내 없이 바로 인사 패널', (await page.locator('[data-view="rules"]').count()) === 0);
      await page.close();
    }

    // 선생님용 정답 창: 수업 화면에 나온 문제의 정답이 같은 브라우저의 다른 창에 뜬다
    {
      const answerPage = await ctx.newPage();
      await open(answerPage, `${base}answer.html`);
      const page = await ctx.newPage();
      await openStep(page, base, { grade: 3, flow: 'lively', teams: 6, kind: 'word' });
      const before = await answerPage.locator('[data-answer]').innerText({ timeout: 3000 }).catch(() => '');
      await click(page, 'reveal');
      await page.waitForTimeout(GUARD_WAIT);
      const shown = (await page.locator('.word-answer-main strong').innerText()).trim();
      check('정답 창: 문제가 나오자마자(정답 공개 전) 수업 화면과 같은 정답이 뜸', before.trim() === shown, `${before.trim()} / ${shown}`);
      await page.close();
      await answerPage.close();
    }

    // 규칙 안내 본문 글자: 1920×1080 에서 32px 이상(교실 뒷자리)
    {
      const page = await ctx.newPage();
      await open(page, base);
      await click(page, 'grade-6');
      await click(page, 'start');
      await click(page, 'goto-1'); // 첫 순서(인사)는 규칙 안내 없이 바로 시작하므로 두 번째 순서에서 잰다
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

    // 수업 중 조작(최종 검토): 느린 클릭, 축하 화면, 두 번 누름, 페이지 떠나기
    for (const run of Object.values(LIVE_CHECKS)) await run(ctx, base, check);

    // 순서 알약·일시정지
    {
      const page = await ctx.newPage();
      await open(page, base);
      await click(page, 'grade-3');
      await click(page, 'start');
      const title = (await page.locator(act('goto-3')).innerText()).replace(/^\S+\s*/, '').trim();
      await click(page, 'goto-3');
      const rules = page.locator('[data-view="rules"]');
      check('알약 4번째 → 그 순서의 규칙 안내', (await rules.isVisible()) && (await rules.innerText()).includes(title), title);
      check('규칙 안내: [시작] 옆에 [실시간 정답 창 열기]가 크게 보임', await page.locator(act('rules-answer-window')).isVisible());
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

    // 인물 퀴즈 (Task 14)
    await checkPerson(ctx, base, check);

    // 미뤄 둔 작은 문제를 고친 것(2026-11-16)
    await FIX_CHECKS.creditLine(browser, base, check);
    await FIX_CHECKS.brokenPhoto(browser, base, check);
    await FIX_CHECKS.nextAndPill(ctx, base, check);
    await FIX_CHECKS.pausedCorrect(ctx, base, check);
    await FIX_CHECKS.storyInputs(ctx, base, check);
    await FIX_CHECKS.reducedMotion(browser, base, check);

    // [▶ 시작] 두 번 누름이 활동 버튼에 닿지 않음
    {
      const page = await ctx.newPage();
      await open(page, base);
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
      check('몸으로 말해요: 맞히면 같은 모둠이 다음 낱말을 이어 감', (await page.locator(act('show-word')).count()) === 0 && (await page.locator('[data-word]').innerText()).trim() !== word && (await page.locator('[data-count]').getAttribute('data-count')) === '1');
      await page.waitForTimeout(GUARD_WAIT);
      await click(page, 'end-round');
      await page.waitForTimeout(100);
      check('몸으로 말해요: [차례 끝] → 결과 한 줄과 다음 모둠 준비 화면', (await page.locator(act('show-word')).isVisible()) && (await page.locator('[data-word]').count()) === 0 && (await page.locator('.gesture-last').innerText()).includes('1개 맞혔어요'));
      check('몸으로 말해요: 다음 모둠으로 차례가 넘어감', (await page.locator('.team.turn').getAttribute('data-team')) === '1');
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
        await open(page, `${base}print.html?grade=${s.grade}&flow=${s.flow}`);
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
        await open(first, base);
        await first.evaluate(() => navigator.serviceWorker.ready.then(() => true));
        const caches = await first.evaluate(async () => {
          const keys = await caches.keys();
          const photo = keys.find((k) => k.startsWith('ttalkkak-bogyul-photos-'));
          const app = keys.find((k) => k.startsWith('ttalkkak-bogyul-') && k !== photo);
          const n = async (k) => (k ? (await (await caches.open(k)).keys()).length : 0);
          return { photo: await n(photo), app: await n(app), appHasPhoto: app ? (await (await caches.open(app)).keys()).some((r) => r.url.includes('/assets/people/')) : true };
        });
        const people = JSON.parse(readFileSync(new URL('../data/people.json', import.meta.url), 'utf8')).people.length;
        check('오프라인 사본: 사진은 따로 담은 캐시에 모두, 화면 파일 캐시에는 사진 없음', caches.photo === people && caches.app > 0 && !caches.appHasPhoto, JSON.stringify(caches));
        await first.close();
        await octx.setOffline(true);
        const page = await octx.newPage();
        await open(page, base);
        // 첫 화면은 자료(data/*.json)를 읽은 뒤에 그려지므로 뜰 때까지 기다린다
        const shown = await page.locator(act('grade-1')).waitFor({ timeout: 5000 }).then(() => true, () => false);
        check('오프라인: 첫 화면이 뜸', shown);
        await click(page, 'grade-1');
        await click(page, 'flow-lively');
        await click(page, 'start');
        await page.locator('[data-kind]').first().waitFor();
        const firstKind = await page.locator('[data-kind]').first().getAttribute('data-kind');
        check('오프라인: g1-lively 첫 순서가 뜸', firstKind === 'greet', String(firstKind));
        await page.locator('[data-step-kind="person"]').click();
        await click(page, 'start-step');
        await page.locator('[data-photo]').waitFor();
        check('오프라인: 인물 사진도 뜸', (await photoWidth(page.locator('[data-photo]'))) > 0);
        await open(page, `${base}print.html?grade=1&flow=lively`);
        await page.locator('body[data-ready]').waitFor();
        check('오프라인: 진행 대본도 열림', (await page.locator('body').innerText()).includes('바를 정 자'));
      } finally {
        await octx.close();
      }
    }

    // 단일 HTML 파일: 새로 만들어 file:// 로 열어 본다(scripts/build-single.mjs, check-single.mjs)
    await buildSingle();
    await checkSingle(browser, check);
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
    console.error(`\n--- 멈추기 전 브라우저 기록(최근 ${trail.length}줄) ---\n${trail.join('\n') || '(없음)'}`);
    process.exit(1);
  });
}
