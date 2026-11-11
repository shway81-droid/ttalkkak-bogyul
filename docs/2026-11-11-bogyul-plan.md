# 딸깍 보결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학년만 고르면 마우스 클릭만으로 40분 모둠 대항 수업(말놀이·몸으로 말해요/상식 퀴즈·인물 퀴즈·이야기)이 진행되는 독립 정적 사이트 '딸깍 보결'과, 화면 없이 쓰는 A4 진행 대본을 만든다.

**Architecture:** 빌드 단계 없는 정적 사이트. 브라우저와 Node가 함께 읽는 ES 모듈 `js/core/*`(계획 만들기·세션 상태·그리기 시간·무작위 뽑기 — DOM 없음, `node --test`로 검사)와 DOM을 그리는 `js/ui/*`·`js/activities/*`로 나눈다. 짬짬이 자료는 `scripts/import-jjam.mjs`가 `data/`로 복사·가공하고, 12세트는 손으로 쓴 `data/sets.json` 한 파일이다. 타이머는 하나뿐이고 활동은 그 타이머의 `tick(dt)`만 받는다 — 그래서 일시정지 하나로 모두 멈춘다.

**Tech Stack:** HTML/CSS/바닐라 JS(ES 모듈, 런타임 의존성 없음), Node 24(`node --test`), Playwright(개발용, 브라우저 검사), GitHub Pages, 서비스 워커.

**Spec:** `docs/2026-11-11-bogyul-design.md` (사용자 확정). 실행자는 이 계획과 설계 문서를 함께 읽는다.

**작업 폴더:** `C:\Users\User\Desktop\claude2\bogyul` (아래 모든 경로는 이 폴더 기준)

## Global Constraints

- 빌드 단계 없음. 런타임 의존성 0. `package.json`의 의존성은 `devDependencies.playwright` 하나뿐.
- 모든 진행은 **마우스 클릭만으로** 된다. 아이들이 화면을 만질 필요가 없다. 키보드 단축키는 덤이다.
- 학생 이름·점수·기록·첫 화면 선택값을 **저장하지 않는다**. `js/`에서 `localStorage`·`sessionStorage`·`indexedDB`를 쓰지 않는다(서비스 워커의 Cache API만 쓴다).
- 순서는 **저절로 넘어가지 않는다.** 시간이 0이 되면 [다음 순서]가 깜빡일 뿐이다.
- **일시정지 버튼 하나**로 순서 시간과 활동 안의 모든 타이머가 함께 멈춘다.
- **순위를 보여 주지 않는다**(1·2·3등, "이긴 모둠" 표시 금지). 마무리는 반 전체 별 합계다.
- 화면 글은 아이들에게 하는 존댓말("~해요")이다. 규칙 안내 본문은 1920×1080에서 최소 32px이다.
- 템플릿 문구에 `{title}`을 넣을 때 바로 뒤에 조사(이/가/을/를/은/는)를 붙이지 않는다("{title} 옆에", "{title}의"처럼 쓴다).
- 화면 아래에 출처 "문항·이야기·인물: 짬짬이"와 사진 출처 페이지 링크를 표시한다(Task 14).
- 짬짬이 저장소는 **읽기만** 한다. `.cache/jjam-classroom`에 따로 받은 사본에서 읽고, 사용자의 `C:\Users\User\Desktop\claude2\jjam-classroom`은 건드리지 않는다.
- GitHub 저장소 생성·공개 발행(Task 13)은 **사용자 확인을 받은 뒤에만** 한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.
- Windows 환경이다. `.gitattributes`로 LF를 고정하고, curl은 `--ssl-no-revoke`를 붙인다(실패사전).

## Review Focus

1. **같은 버튼을 빠르게 두 번 누름**([맞혔어요], [모두 ★], [다음 순서]): 별은 한 번만 들어가고 순서도 한 칸만 넘어가야 한다. → Task 7·8 e2e의 더블클릭 검사, Task 4 `guard` 검사.
2. **작은 화면**(교사 노트북 1366×768, 1280×720)과 **모둠 8개**: 활동 화면이 세로 스크롤 없이 한 화면에 들어오고 별판이 한 줄에 들어가야 한다. → Task 12 e2e의 넘침 검사.
3. **일시정지 중 조작**: 멈춘 채 [맞혔어요]·별 더하기는 되지만 시간은 흐르지 않고, 순서를 옮기면 새 순서는 규칙 안내에서 멈춤 없이 시작한다. → Task 4 세션 검사.
4. **문항이 바닥남**(10분 넘게 진행, 짧은 풀): 같은 문항이 연달아 나오지 않고 다시 섞여 이어져야 한다. → Task 2 `makeDeck` 검사.
5. **별 되돌리기를 기록보다 많이 누름**, 0개인 모둠에서 빼기: 별은 음수가 되지 않고 오류도 나지 않아야 한다. → Task 4 세션 검사.

---

## 파일 구조

```
index.html                 첫 화면 + 세트 진행(단일 페이지)
print.html                 진행 대본 인쇄 (?grade=3&flow=lively)
manifest.json  favicon.svg  sw.js
css/base.css               색·글꼴 토큰, 버튼, 공통
css/app.css                첫 화면·위쪽 띠·별판·규칙 안내·활동 화면
css/print.css              A4 한 장
assets/fonts/              Pretendard 서브셋 + coverage.txt + LICENSE.txt (짬짬이에서 복사)
js/main.js                 시작점: 자료 읽기 → 첫 화면 → 세트 진행
js/print.js                진행 대본 화면
js/core/rng.js             makeRng · shuffle · makeDeck
js/core/drawing.js         pathLength · stepSeconds · drawingTiming · fitsSlot
js/core/flows.js           FLOWS · bandOf
js/core/wordTypes.js       WORD_TYPES (말놀이 유형 이름·묻는 말)
js/core/rules.js           rulesFor(kind, band)
js/core/plan.js            poolFor · buildPlan
js/core/session.js         세션 상태(시간·일시정지·차례·별·되돌리기)
js/core/script.js          buildScript(plan) — 진행 대본 내용
js/core/data.js            loadData(fetchFn)
js/ui/dom.js  js/ui/sfx.js  js/ui/start.js  js/ui/runner.js  js/ui/guard.js
js/activities/index.js     ACTIVITIES 등록표
js/activities/{greet,word,gesture,quizboard,story,draw,celebrate}.js
data/words.json data/stories.json data/drawings.json data/quiz.json   (가져오기 생성물)
data/sets.json data/decorate.json                                      (손으로 쓰는 파일)
scripts/import-jjam.mjs  scripts/validate-data.mjs  scripts/check-font-coverage.mjs  scripts/e2e.mjs  scripts/serve.mjs
tests/*.test.mjs
.github/workflows/ci.yml   package.json  README.md  .gitignore  .gitattributes
```

### 활동 모듈 공통 인터페이스 (Task 6 이후 모든 활동이 따름)

```js
// js/activities/<kind>.js
export function mount(el, ctx) { /* el에 그림 */ return { tick(dtMs) {}, destroy() {} }; }
// ctx = {
//   step,            // plan.steps[i] (kind·title·minutes·content)
//   band,            // 'lower' | 'middle' | 'upper'
//   teamCount,       // 4~8
//   state,           // session 상태 객체 (읽기 전용으로 쓴다)
//   api: { awardTurn(), passTurn(), awardTeams(teams), awardAll(), currentTurn() }, // 별·차례 변경 후 별판을 다시 그림
//   sfx,             // { correct(), timeUp() }
//   guard,           // guard(fn) → 400ms 안의 반복 클릭을 무시하는 함수
// }
```
`tick(dtMs)`는 **세션이 '진행 중'이고 일시정지가 아닐 때만** 불린다. 활동 안의 모든 카운트다운(의논 시간, 그리기 단계)은 반드시 `tick`으로만 줄인다(`setTimeout`/`setInterval` 금지).

### 버튼 이름 규칙 (e2e가 이것으로 누른다)

모든 조작 버튼에 `data-act`를 단다. 정해 둔 이름:
`grade-<n>`, `flow-<lively|calm>`, `teams-<n>`, `start`, `print`, `start-step`(규칙 안내의 시작), `next-step`, `goto-<i>`, `pause`, `mute`, `fullscreen`, `exit`, `exit-confirm`, `star-add-<t>`, `star-remove-<t>`, `undo`, `greet-next`, `hint`, `reveal`, `correct`, `pass`, `next-item`, `show-word`, `team-toggle-<t>`, `all-correct`, `award-and-next`, `award-all`, `stage-prev`, `stage-next`, `pick-number`, `draw-start`, `draw-prev`, `draw-next`, `home`.
별 합계는 `data-total` 속성(숫자)을 가진 요소에, 남은 시간은 `data-remain` 요소에 보인다.

---

### Task 1: 프로젝트 뼈대와 그리기 시간 계산

**Files:**
- Create: `package.json`, `package-lock.json`, `.gitignore`, `.gitattributes`, `README.md`(한 줄 소개만, Task 12에서 채움), `js/core/drawing.js`
- Test: `tests/drawing.test.mjs`

**Interfaces:**
- Produces: `pathLength(d: string): number`, `stepSeconds(step: {d: string[], seconds?: number}, viewBox: string): number`, `drawingTiming(drawing): {sec: number[], totalSec: number}`, `fitsSlot(drawing, slotSec = 480, minDecorateSec = 60): boolean`, 상수 `SEC_BASE=8`, `SEC_PER_LENGTH=12`, `SEC_PER_EXTRA_STROKE=2`, `SEC_RANGE=[10, 30]`

- [ ] **Step 1: 저장소 만들기** — `git init`, `.gitignore`(`node_modules/`, `.cache/`, `.superpowers/`, `test-results/`), `.gitattributes`(`* text=auto eol=lf`, `*.woff2 binary`, `*.png binary`), `package.json`:
  `{"name":"ttalkkak-bogyul","private":true,"type":"module","scripts":{"test":"node --test tests/ && node scripts/validate-data.mjs && node scripts/check-font-coverage.mjs","import":"node scripts/import-jjam.mjs","e2e":"node scripts/e2e.mjs","serve":"node scripts/serve.mjs"},"devDependencies":{"playwright":"^1.61.1"}}`
  (`validate-data`·`check-font-coverage`는 Task 3·11에서 생긴다. 그 전에는 `node --test tests/`만 돌린다.) 이어서 `npm install`로 `package-lock.json`을 만든다.
- [ ] **Step 2: 실패하는 검사 쓰기** — `tests/drawing.test.mjs`
  - `pathLength('M 0 0 C 0 0, 100 0, 100 0')`가 100±0.5
  - `pathLength('M 0 0 C 0 0, 30 0, 30 0 C 30 0, 30 40, 30 40')`가 70±0.5 (C가 이어질 때 앞 끝점에서 시작)
  - `stepSeconds({d:['M 0 0 C 0 0, 1 0, 1 0']}, '0 0 400 500')`가 10 (하한)
  - viewBox `'0 0 300 400'`(대각선 500)에서 길이 250인 직선 획 하나 → 14 (8 + 12×0.5), 길이 125인 획 둘 → 16 (8 + 12×0.5 + 2), 길이 1500인 획 하나 → 30 (상한)
  - `stepSeconds({d:[...], seconds: 17}, ...)`가 17
  - `drawingTiming({viewBox, steps:[a,b]})`의 `totalSec`이 `sec`의 합
  - `fitsSlot({...totalSec 300, coloringSeconds 150})`가 false(300+150 > 480−60), 200+150이면 true
- [ ] **Step 3: 실행해서 실패 확인** — `node --test tests/drawing.test.mjs` → FAIL(모듈 없음)
- [ ] **Step 4: `js/core/drawing.js` 구현** — 경로는 절대 좌표 `M`·`C`만 나온다(자료 전수 확인함). 3차 베지어 길이는 곡선마다 32구간 샘플링 합. `stepSeconds = round(clamp(SEC_BASE + SEC_PER_LENGTH * (len / diagonal) + SEC_PER_EXTRA_STROKE * (d.length − 1), 10, 30))`, `diagonal = hypot(viewBox w, h)`. 짬짬이 그리기 `draw/js/app.js`의 `prepare()`와 같은 공식이다. `fitsSlot`은 `totalSec + coloringSeconds <= slotSec − minDecorateSec`.
- [ ] **Step 5: 통과 확인** — `node --test tests/drawing.test.mjs` → PASS
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 프로젝트 뼈대와 그리기 단계 시간 계산"`

---

### Task 2: 무작위 뽑기와 짬짬이 자료 가져오기

**Files:**
- Create: `js/core/rng.js`, `scripts/import-jjam.mjs`, `data/words.json`, `data/stories.json`, `data/drawings.json`, `data/quiz.json`
- Test: `tests/rng.test.mjs`, `tests/import.test.mjs`

**Interfaces:**
- Consumes: `drawingTiming` (Task 1)
- Produces:
  - `makeRng(seed: number): () => number` (mulberry32, [0,1))
  - `shuffle(arr, rng): Array` (새 배열)
  - `makeDeck(items, rng): { next(): item, size: number }` — 뽑을 때마다 겹치지 않게 내주고, 다 쓰면 다시 섞는다. 새로 섞은 첫 장이 직전 장과 같지 않게 한다(`items.length > 1`일 때).
  - `scripts/import-jjam.mjs`에서 export: `parseQuizGame(source: string, topic: string): QuizItem[]`, `filterWords(items): WordItem[]`, `QUIZ_TOPICS`, `WORD_TYPES_KEPT`
  - 자료 형식:
    - `data/words.json` = `{ source:{repo, commit}, items: WordItem[] }`, `WordItem` = 짬짬이 낱말 그대로(`id,type,level,topic,prompt,hint,answer,also,note` / `gesture`는 `id,type,level,topic,word`)
    - `data/stories.json` = `{ source, stories: Story[] }` (짬짬이 이야기 필드 그대로, `sensitivity === 'low'`만)
    - `data/drawings.json` = `{ source, drawings: Drawing[] }` (짬짬이 필드 + `sec: number[]`, `totalSec: number`)
    - `data/quiz.json` = `{ source, items: QuizItem[] }`, `QuizItem = { id: '<topic>-<n>', topic, bands: Band[], q: string, emoji?: string, a: string, o: string[3] }`

- [ ] **Step 1: 실패하는 검사 쓰기**
  - `tests/rng.test.mjs`: 같은 씨앗이면 같은 수열; `shuffle` 결과가 원래 원소의 순열; `makeDeck([1,2,3])`에서 3번 뽑으면 1·2·3이 모두 한 번씩; 씨앗 1~200에 대해 30번 뽑을 때 연달아 같은 값이 나오지 않음; `makeDeck([7])`은 계속 7.
  - `tests/import.test.mjs`:
    - `parseQuizGame("const Q = [\n  { q: \"<span class='q-emoji'>🚗</span><br>이 탈것의 이름은?\", a: \"자동차\", o: [\"경주용차\", \"여객선\", \"케이블카\"] },\n  { q: '물이 얼면?', a: '얼음', o: ['수증기','소금','모래'] },\n];", 'vehicle-quiz')` → 2개, 첫째 `{emoji:'🚗', q:'이 탈것의 이름은?', a:'자동차'}`, 둘째 `emoji` 없음, `bands`는 `QUIZ_TOPICS['vehicle-quiz']`
    - `q`에 다른 HTML 태그가 남는 문항은 버린다
    - `filterWords`는 `WORD_TYPES_KEPT` 밖의 유형(`person`, `chain`, `relay`, `urimal`)을 버린다
- [ ] **Step 2: 실패 확인** — `node --test tests/rng.test.mjs tests/import.test.mjs` → FAIL
- [ ] **Step 3: `js/core/rng.js` 구현**
- [ ] **Step 4: `scripts/import-jjam.mjs` 구현**
  - 실행: `node scripts/import-jjam.mjs` → `.cache/jjam-classroom`이 없으면 `git clone --depth 1 https://github.com/shway81-droid/jjam-classroom.git .cache/jjam-classroom`, 있으면 `git -C .cache/jjam-classroom pull --ff-only`. 커밋 해시를 `source.commit`에 적는다.
  - 원본: `word/data/words.json`, `story/data/stories.json`, `draw/data/drawings.json`, `quiz/games/<topic>/game.js`
  - `WORD_TYPES_KEPT = ['choseong','proverb','riddle','idiom','fourword','opposite','mimetic','scramble','spelling','gesture']`
  - `parseQuizGame`: `{ q: ..., a: '...', o: [...] }` 한 줄짜리 객체 리터럴을 정규식으로 찾아 `node:vm`의 `runInNewContext('(' + literal + ')')`로 읽는다(사용자 본인 저장소의 자료 리터럴). `<span class='q-emoji'>X</span><br>` → `emoji: X`.
  - `QUIZ_TOPICS` (주제 → 학년대, 결정값):
    - `lower`: animal-quiz, vehicle-quiz, food-name, clothing-quiz, stationery-quiz, household-quiz, drink-snack, bird-quiz, building-quiz, tool-quiz, sea-life, insect-quiz, family-quiz, safety-quiz, health-habit, manner-quiz, weather-quiz, rainbow-quiz, sense-quiz, dino-quiz, fairytale-quiz, folktale-quiz, aesop-quiz, riddle-quiz, job-do, town-place, habitat-quiz
    - `middle`: plant-quiz, plant-part-quiz, science-life, water-state-quiz, magnet-quiz, korean-food, korea-culture, nationalday-quiz, local-specialty, landform-quiz, province-quiz, korea-geo, punctuation-quiz, measure-unit, eco-save-quiz, economy-quiz, tech-device, hero-figure, money-count, analogy-quiz
    - `upper`: science-quiz, space-quiz, korea-history, heritage-quiz, world-hero, world-culture, world-landmark, food-country, continent-quiz, sentence-type-quiz, magnet-quiz, measure-unit, economy-quiz
    - 한 주제가 여러 학년대에 들 수 있다(`bands` 배열). 원본에서 문항 0개인 주제는 경고만 내고 넘어간다.
  - 그림: `drawingTiming`으로 `sec`·`totalSec`을 미리 계산해 넣는다.
  - 마지막에 유형·난이도·학년대별 개수 요약을 출력한다.
- [ ] **Step 5: 검사 통과 확인** — `node --test tests/rng.test.mjs tests/import.test.mjs` → PASS
- [ ] **Step 6: 가져오기 실행** — `node scripts/import-jjam.mjs` → `data/` 네 파일 생성. 요약에서 `quiz` 학년대마다 100문항 이상, `gesture` 난이도마다 50개 이상인지 눈으로 확인.
- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat: 무작위 뽑기와 짬짬이 자료 가져오기"`

---

### Task 3: 흐름·세트 정의·계획 만들기·자료 검증

**Files:**
- Create: `js/core/flows.js`, `js/core/wordTypes.js`, `js/core/plan.js`, `data/sets.json`, `data/decorate.json`, `scripts/validate-data.mjs`
- Test: `tests/plan.test.mjs`, `tests/validate.test.mjs`

**Interfaces:**
- Consumes: `makeRng`, `makeDeck`, `shuffle` (Task 2), `fitsSlot` (Task 1)
- Produces:
  - `FLOWS = { lively: {label:'신나게 열기', icon:'🎉', blurb, slots}, calm: {label:'차분하게 열기', icon:'🍃', blurb, slots} }`, `slots`는 `[slot, minutes][]`:
    - lively: `greet 3, word 10, team 10, story 7, draw 8, celebrate 2`
    - calm: `greet 3, draw 8, story 7, word 10, team 10, celebrate 2`
  - `bandOf(grade: 1..6): 'lower'|'middle'|'upper'` (1·2 / 3·4 / 5·6)
  - `WORD_TYPES: Record<type, {title: string, ask: string}>` — 9개 유형(`gesture` 제외). 예: `choseong: {title:'ㄱㄴㄷ 초성퀴즈', ask:'초성을 보고 낱말을 맞혀요'}`
  - `poolFor(slot: 'word'|'team'|'story'|'draw', set, data): Item[]`
  - `buildPlan(set, data, rng): Plan`
    - `Plan = { setId, grade, band, flow, title: '<n>학년 · <flow label>', steps: Step[] }`
    - `Step = { slot, kind, title, minutes, content }`, `kind`는 `greet|word|gesture|quizboard|story|draw|celebrate`
    - `content`: word·gesture·quizboard → `{ deck }`, story → `{ story }`, draw → `{ drawing, decorate: string }`(그림 제목을 `{title}`에 넣은 문구), greet·celebrate → `{}`
    - `title`: greet '인사', word '말놀이', gesture '몸으로 말해요', quizboard '상식 퀴즈', story '이야기', draw '그리기', celebrate '축하'
  - `validateData(data): string[]` (오류 문구 목록, `scripts/validate-data.mjs`에서 export하고 CLI로도 실행)
- 세트 형식(`data/sets.json`):
  ```json
  { "version": 1, "sets": [
    { "id": "g3-lively", "grade": 3, "flow": "lively",
      "word":  { "types": ["choseong","riddle"], "levels": ["easy","normal"] },
      "team":  { "kind": "gesture", "levels": ["normal"] },
      "story": {},
      "draw":  {} } ] }
  ```
  `team`이 quizboard이면 `{ "kind": "quizboard" }`(학년대 자동). story는 학년대의 이야기 전체, draw는 학년대 난이도(lower→easy, middle→normal, upper→hard) 가운데 `fitsSlot`인 그림 전체가 후보다.
- 꾸미기 문구(`data/decorate.json`): `{ "<theme>": [문구 3개] }`, theme은 `animal, plant, season, thing, person, food, fantasy` 7개. 좋은 예: `"{title} 옆에 친구를 하나 더 그려 줘요"`, `"{title}의 이름을 지어 말풍선을 붙여 줘요"`. 나쁜 예(조사 규칙 위반): `"{title}이 있는 곳을 그려요"`.

- [ ] **Step 1: 12세트 초안 쓰기** — `data/sets.json`. 같은 학년의 두 세트는 말놀이 유형과 team 종류가 서로 다르다. 홀수 학년은 lively=gesture·calm=quizboard, 짝수 학년은 반대.

  | 세트 | word types (levels) | team |
  |---|---|---|
  | g1-lively | riddle, mimetic (easy) | gesture (easy) |
  | g1-calm | opposite, choseong (easy) | quizboard |
  | g2-lively | choseong, mimetic (easy) | quizboard |
  | g2-calm | riddle, opposite (easy) | gesture (easy) |
  | g3-lively | choseong, riddle (easy, normal) | gesture (normal) |
  | g3-calm | proverb, scramble (easy, normal) | quizboard |
  | g4-lively | proverb, scramble (normal) | quizboard |
  | g4-calm | choseong, riddle (normal) | gesture (normal) |
  | g5-lively | idiom, fourword (normal) | gesture (hard) |
  | g5-calm | proverb, spelling (normal) | quizboard |
  | g6-lively | fourword, proverb (normal, hard) | quizboard |
  | g6-calm | idiom, spelling (normal, hard) | gesture (hard) |

  `data/decorate.json`도 7주제 × 3문구로 쓴다.
- [ ] **Step 2: 실패하는 검사 쓰기**
  - `tests/plan.test.mjs`(실제 `data/`를 읽음):
    - `FLOWS.lively`·`FLOWS.calm` 분의 합이 각각 40
    - `bandOf(1)==='lower'`, `bandOf(4)==='middle'`, `bandOf(6)==='upper'`
    - g3-lively 계획: 순서 6개의 `kind`가 `['greet','word','gesture','story','draw','celebrate']`, 분이 `[3,10,10,7,8,2]`, 제목 `'3학년 · 신나게 열기'`
    - g3-calm 계획의 kind 순서가 `['greet','draw','story','word','quizboard','celebrate']`
    - word 덱에서 30장을 뽑으면 모두 `types`·`levels` 안이고 중복 없음
    - quizboard 덱의 문항은 모두 `bands`에 그 세트의 학년대를 포함
    - story는 `grades`에 학년대 포함, draw는 학년대 난이도이고 `fitsSlot` 참, `decorate`에 `{title}`이 남지 않음
    - 같은 씨앗 → 같은 계획(story id·drawing id·덱 첫 5장 동일)
  - `tests/validate.test.mjs`: 실제 자료 → `validateData(...)`가 `[]`; 세트 하나를 지운 자료 → 'g3-calm' 같은 빠진 세트를 말하는 오류; word 풀이 30개 미만인 세트 → 그 세트 id가 든 오류; 같은 학년 두 세트의 team kind가 같으면 오류
- [ ] **Step 3: 실패 확인** — `node --test tests/plan.test.mjs tests/validate.test.mjs` → FAIL
- [ ] **Step 4: `flows.js`·`wordTypes.js`·`plan.js` 구현**
- [ ] **Step 5: `scripts/validate-data.mjs` 구현** — 검사 항목(설계 10.2):
  - 학년 1~6 × 흐름 lively·calm 세트가 정확히 하나씩(12개)
  - 풀 크기: word ≥ 30, gesture ≥ 15, quizboard ≥ 20, story ≥ 3, draw ≥ 3
  - 같은 학년 두 세트: word types 겹침 없음, team kind 다름
  - 모든 그림 theme에 꾸미기 문구 3개, 문구에 `{title}` 바로 뒤 조사(`/\{title\}(이|가|을|를|은|는)/`) 없음
  - 실패하면 오류를 한 줄씩 찍고 종료 코드 1
- [ ] **Step 6: 통과 확인** — `node --test tests/ && node scripts/validate-data.mjs` → PASS, "자료 검증 통과" 출력
- [ ] **Step 7: 커밋** — `git commit -m "feat: 40분 흐름·12세트 정의·계획 만들기·자료 검증"`
- [ ] **Step 8: 🔶 사용자 확인 지점** — 실행을 맡은 쪽(사람 또는 조율자)은 위 12세트 표를 사용자에게 보여 주고 확인을 받는다(설계 8절). 고칠 곳이 있으면 `data/sets.json`만 고치고 Step 6을 다시 돌린다. 이 확인 없이 Task 13(발행)으로 가지 않는다. 다른 작업은 계속해도 된다.

---

### Task 4: 세션 상태 — 시간·일시정지·차례·별·되돌리기

**Files:**
- Create: `js/core/session.js`, `js/ui/guard.js`
- Test: `tests/session.test.mjs`, `tests/guard.test.mjs`

**Interfaces:**
- Consumes: `Plan` (Task 3)
- Produces (모두 상태 객체를 직접 바꾸는 함수):
  - `createSession(plan, teamCount): State` → `{ plan, teamCount, stepIndex: 0, phase: 'rules', remainMs: 첫 순서 분×60000, paused: false, stars: Array(teamCount).fill(0), turn: 0, log: [] }`
  - `beginStep(s)` phase → 'active'
  - `goToStep(s, i)` stepIndex=i, phase='rules', remainMs 재설정, `paused=false`. 별·차례는 유지.
  - `nextStep(s)` 마지막 순서면 아무것도 안 함
  - `tick(s, dtMs)` phase가 'active'이고 멈춤이 아닐 때만 `remainMs -= dtMs`(음수 허용)
  - `isOvertime(s): boolean` (`remainMs <= 0`)
  - `togglePause(s)`
  - `addStar(s, team)`, `removeStar(s, team)`(0이면 아무것도 안 하고 기록도 안 남김)
  - `awardTurn(s): number` 차례 모둠 +1, 차례 다음으로, 준 모둠 번호 반환
  - `passTurn(s)` 차례만 다음으로
  - `awardTeams(s, teams: number[])` 한 번의 기록으로 여러 모둠 +1
  - `awardAll(s)` = `awardTeams(s, 전체)`
  - `undo(s): boolean` 마지막 별 기록 하나를 되돌림(차례도 그 기록 전으로). 기록이 없으면 false.
  - `totalStars(s): number`
  - `guard(fn, ms = 400)` (`js/ui/guard.js`): 마지막 실행 뒤 `ms` 안의 호출은 무시. 시계는 `performance.now`, 검사용으로 `guard(fn, ms, now)` 세 번째 인자 허용.

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/session.test.mjs`
  - 생성 직후: `phase==='rules'`, `remainMs===180000`(greet 3분), 별 모두 0
  - 'rules' 단계에서 `tick(s, 5000)` → remainMs 그대로; `beginStep` 후 `tick(s,5000)` → 175000
  - `togglePause` 후 tick → 그대로; 멈춘 채 `awardTurn` → 별은 늘어남, remainMs 그대로 (Review Focus 3)
  - 멈춘 채 `goToStep(s, 1)` → `paused===false`, `phase==='rules'`, remainMs 600000 (Review Focus 3)
  - `tick` 200000 → `isOvertime` true, `stepIndex` 그대로(저절로 안 넘어감)
  - 8모둠: `awardTurn` 9번 → `stars` = `[2,1,1,1,1,1,1,1]`, `turn===1`
  - `passTurn` → 별 변화 없이 차례만 이동
  - `awardAll` 후 `undo` → 모두 원래대로(기록 1개로 되돌림)
  - `undo`를 기록 수보다 많이 → false, 별 음수 없음; 0인 모둠 `removeStar` → 0 유지 (Review Focus 5)
  - `awardTurn` 후 `undo` → 별과 `turn`이 모두 원래대로
  - `nextStep`을 마지막 순서에서 → stepIndex 그대로
- [ ] **Step 2: `tests/guard.test.mjs`** — 가짜 시계로 0ms·100ms·450ms에 부르면 fn이 2번 실행 (Review Focus 1)
- [ ] **Step 3: 실패 확인** — `node --test tests/session.test.mjs tests/guard.test.mjs` → FAIL
- [ ] **Step 4: `session.js`·`guard.js` 구현** — `log` 항목은 `{ teams: number[], prevTurn: number }`. `removeStar`는 `{ teams:[t], delta:-1, prevTurn }`로 기록해 되돌릴 수 있게 한다.
- [ ] **Step 5: 통과 확인** — `node --test tests/` → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat: 세션 상태(시간·일시정지·차례·별·되돌리기)"`

---

### Task 5: 규칙 안내 문구와 진행 대본 내용

**Files:**
- Create: `js/core/rules.js`, `js/core/script.js`
- Test: `tests/rules.test.mjs`, `tests/script.test.mjs`

**Interfaces:**
- Consumes: `Plan` (Task 3), `WORD_TYPES` (Task 3)
- Produces:
  - `rulesFor(kind, band): { lines: string[], prep?: string }` — 아이에게 하는 말투, `lines` 3개 이하, `band==='lower'`면 줄마다 25자 이하. `draw`는 `prep: '종이(공책 뒷장도 좋아요)와 연필을 꺼내요'`. 내용은 설계 5·7절(차례 모둠만 답, 다른 모둠은 먼저 외치지 않기, 퀴즈는 손가락으로 동시에, 맞히면 ★·발표해도 ★·끝까지 하면 ★).
  - `buildScript(plan): Script` — `Script = { title, sections: Section[], tally: string }`, `Section = { minutes, title, how: string[], items?: {q: string, a: string}[], words?: string[], story?: {title, text: string[], questions: string[]}, drawing?: {steps: string[][], viewBox, decorate} }`
    - word → `items` 10개(덱에서), 문제는 `WORD_TYPES[type].ask`와 prompt를 합친 것
    - gesture → `words` 15개
    - quizboard → `items` 10개(정답과 보기 포함 문장)
    - story → 이야기 본문과 `mainQuestion` + `followUpQuestions`
    - draw → 단계별 누적 경로(`steps[i]` = 0..i단계의 `d` 전부)
    - `tally` = '칠판에 모둠별로 바를 정(正) 자를 써서 별을 셉니다'

- [ ] **Step 1: 실패하는 검사 쓰기**
  - `rules.test`: 모든 kind × band에 대해 `lines.length` 1~3, lower는 각 줄 25자 이하, 어떤 줄에도 '등'·'1위'·'우승'이 없음
  - `script.test`: g3-lively 계획(씨앗 고정)의 대본에 섹션 6개, 분 합 40, word 섹션 `items` 10개이고 모두 `a`가 비어 있지 않음, gesture 섹션 `words` 15개, story 섹션 `text`가 원본 `story` 배열과 같음, draw 섹션 `steps` 길이가 그림 단계 수와 같고 마지막 원소가 모든 `d`를 담음
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `node --test tests/` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: 규칙 안내 문구와 진행 대본 내용"`

---

### Task 6: 화면 틀 — 첫 화면·위쪽 띠·별판·규칙 안내·인사·축하

**Files:**
- Create: `index.html`, `css/base.css`, `css/app.css`, `js/main.js`, `js/core/data.js`, `js/ui/dom.js`, `js/ui/sfx.js`, `js/ui/start.js`, `js/ui/runner.js`, `js/activities/index.js`, `js/activities/greet.js`, `js/activities/celebrate.js`, `scripts/serve.mjs`, `scripts/e2e.mjs`(뼈대)
- Test: `scripts/e2e.mjs` (Playwright)

**Interfaces:**
- Consumes: Task 3·4·5의 모든 core 함수
- Produces:
  - `loadData(fetchFn = fetch): Promise<{words, stories, drawings, quiz, sets, decorate}>`
  - `renderStart(root, { sets, onStart({grade, flow, teams}), onPrint({grade, flow}) })`
  - `runSession(root, { plan, teamCount, sfx, onExit })`
  - `ACTIVITIES: Record<kind, {mount}>` — 이 작업에서는 greet·celebrate만 진짜이고, 나머지 kind는 제목과 "준비 중" 한 줄만 그리는 임시 모듈(`js/activities/index.js` 안). Task 7~10이 하나씩 바꿔 끼운다.
  - `createSfx(): { correct(), timeUp(), muted: boolean, toggle() }` (Web Audio, 실패해도 조용히 넘어감)
  - `scripts/serve.mjs`: `node:http` 정적 서버, `PORT` 환경변수(기본 4173)
  - `scripts/e2e.mjs`의 export `runSet(page, {grade, flow, teams})` — 첫 화면에서 `grade-<n>`·`flow-<f>`·`teams-<n>`·`start` → 순서마다 `start-step` → 그 활동의 기본 조작 한두 번(Task 7~10이 kind별로 채우는 `ACT_STEPS[kind]` 목록; 처음엔 빈 목록) → `next-step` → 축하 화면까지. 콘솔 오류를 모아 돌려준다.
- 화면 요구(설계 6절):
  - 첫 화면: 학년 버튼 6개(고르기 전 [시작] 꺼짐), 흐름 카드 2개(순서 막대 + `FLOWS[flow].blurb`, 기본 lively), 모둠 수 4~8(기본 6), [▶ 시작], "🖨 화면을 못 쓰나요? 선생님용 진행 대본 인쇄" 링크(`print.html?grade=&flow=` 새 탭), 아래 출처 "문항·이야기·그림: 짬짬이". 선택값을 저장하지 않는다.
  - 위쪽 띠: 세트 제목, 순서 알약 6개(누르면 `goToStep`), 남은 시간 `m:ss`(넘치면 `+m:ss`와 [다음 순서] 깜빡임, `timeUp()` 한 번), ⏸/▶, 🔊/🔇, ⛶ 전체화면, [다음 순서 ▶], ✕(화면 안 확인 상자 → 첫 화면).
  - 별판: 모둠 칩 `n모둠 ★k`, 차례 모둠 강조, 칩마다 [+]·[−], [↶ 되돌리기]. 순위 표시 없음.
  - 규칙 안내: 순서 제목, `rulesFor` 줄들(32px 이상), `prep`, 큰 [▶ 시작] → `beginStep` 후 활동 `mount`.
  - 타이머: `requestAnimationFrame`이 아니라 `setInterval(200ms)` + `performance.now()` 차이로 `tick(state)`와 활동 `tick`을 부른다(배경 탭에서도 흐름 유지). 멈춤·'rules' 단계에서는 활동 `tick`을 부르지 않는다.
  - 인사(greet): 패널 4장을 [다음]으로 넘김 — ① 선생님 소개(칠판에 이름 쓰기 안내) ② 모둠 정하기(모둠 수만큼 칩) ③ 오늘의 약속 3개 ④ 별 받는 법.
  - 축하(celebrate): `totalStars` 크게("오늘 우리 반 별 N개!"), 돌아보기 "가장 재미있었던 순서에 손을 들어요"와 이 세트의 순서 제목들, [처음 화면으로].
  - 전역 키(덤): Space=일시정지, →=다음 순서.

- [ ] **Step 1: e2e 뼈대 쓰기** — `scripts/e2e.mjs`: 서버를 띄우고 1920×1080에서 g3-lively·g4-calm을 `runSet`으로 끝까지 진행. 검사: 콘솔 오류 0, 축하 화면에 "오늘 우리 반 별"이 보임, 첫 화면에서 학년을 고르기 전 [시작]이 `disabled`, 순서 알약 4번째를 누르면 그 순서의 규칙 안내가 보임, ⏸을 누르고 2초 기다리면 남은 시간 글자가 바뀌지 않음.
- [ ] **Step 2: 실패 확인** — `npx playwright install chromium` 후 `node scripts/e2e.mjs` → FAIL(파일 없음)
- [ ] **Step 3: 화면 구현** — 위 요구대로. DOM 생성은 `h(tag, props, ...children)` 하나로 통일.
- [ ] **Step 4: 통과 확인** — `node scripts/e2e.mjs` → PASS, `node --test tests/` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: 첫 화면·위쪽 띠·별판·규칙 안내·인사·축하"`

---

### Task 7: 말놀이 모둠 대항

**Files:**
- Create: `js/activities/word.js`
- Modify: `js/activities/index.js` (임시 모듈 → 진짜), `css/app.css`, `scripts/e2e.mjs`

**Interfaces:**
- Consumes: 활동 공통 인터페이스, `step.content.deck`, `WORD_TYPES`
- Produces: `mount(el, ctx)` (kind `word`)

- 동작(설계 5.2):
  - 화면: "n모둠 차례 · 의논 10초"(카운트다운, `DISCUSS_SEC = 10`), 유형 이름(`WORD_TYPES[type].title`)과 주제, 문제(`prompt`, 아주 크게), 힌트는 [💡 힌트]를 눌러야 보임
  - 버튼(화면 아래, 큰 크기): [💡 힌트] [정답 보기] [⭕ 맞혔어요 (+★)] [➡ 다음 모둠에게]
  - [맞혔어요] → `api.awardTurn()` + `sfx.correct()` + 정답을 2초 보여 주고 다음 문제(새 차례 모둠, 의논 시간 다시)
  - [다음 모둠에게] → `api.passTurn()`, 같은 문제, 의논 시간 다시. 차례가 이 문제를 처음 받은 모둠으로 돌아오면 정답을 보여 주고 [다음 문제] 버튼만 남김(별 없음)
  - [정답 보기] → 정답과 `also`, `note`를 보여 주고 [다음 문제](별 없음, `passTurn`)
  - 모든 점수 버튼은 `ctx.guard`로 감싼다
  - 의논 시간이 0이 되면 숫자만 멈춤(자동 진행 없음)
- [ ] **Step 1: e2e 검사 추가** — g3-lively 말놀이 순서에서: [맞혔어요] **더블클릭** → 별 합계 +1만 (Review Focus 1); [다음 모둠에게]를 모둠 수만큼 누르면 정답이 보이고 [다음 문제]만 남음; ⏸ 상태에서 의논 카운트다운이 줄지 않음; 문제 글자가 화면 안에 다 보임(요소 bounding box가 뷰포트 안)
- [ ] **Step 2: 실패 확인** — `node scripts/e2e.mjs` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `node scripts/e2e.mjs` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: 말놀이 모둠 대항"`

---

### Task 8: 몸으로 말해요와 상식 퀴즈 판

**Files:**
- Create: `js/activities/gesture.js`, `js/activities/quizboard.js`
- Modify: `js/activities/index.js`, `css/app.css`, `scripts/e2e.mjs`

**Interfaces:**
- Consumes: 활동 공통 인터페이스, `step.content.deck`
- Produces: `mount` (kind `gesture`, `quizboard`)

- 몸으로 말해요(설계 5.3):
  - 준비 화면: "n모둠 대표 한 명이 화면을 등지고 서요" + [▶ 낱말 보이기] (낱말이 미리 보이지 않게)
  - 낱말 화면: 낱말을 화면 가득, 제한 시간 `GESTURE_SEC = 60` 카운트다운, [⭕ 맞혔어요 (+★)] → `awardTurn`, [⏭ 넘기기] → `passTurn`. 둘 다 다음 모둠의 준비 화면으로.
  - 시간이 0이 되면 `sfx.timeUp()` 한 번, 자동 진행 없음.
- 상식 퀴즈 판:
  - 문제(+`emoji` 있으면 크게), 보기 4개에 ①②③④(보기 순서는 덱을 만들 때가 아니라 문제를 보여 줄 때 `shuffle`), "모든 모둠 의논 15초"(`QUIZ_DISCUSS_SEC = 15`), 0이 되면 "손가락을 들어요!" 표시
  - [정답 보기] → 정답 보기 강조 + 모둠 버튼 줄(누르면 켜짐/꺼짐) + [모두 맞혔어요] + [별 주고 다음 문제]
  - [별 주고 다음 문제] → 켜진 모둠으로 `awardTeams`(0개면 별 없이) → 다음 문제
  - 차례 개념을 쓰지 않는다(별판의 차례 강조도 이 순서에서는 끔)
- [ ] **Step 1: e2e 검사 추가** — g3-lively 몸으로 말해요: 준비 화면에서 낱말 글자가 DOM에 없음, [맞혔어요] 더블클릭 → +1; g3-calm 상식 퀴즈: 모둠 2개를 켜고 [별 주고 다음 문제] → 합계 +2, 다음 문제의 모둠 버튼은 모두 꺼져 있음, [모두 맞혔어요] → 모든 버튼 켜짐
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `node scripts/e2e.mjs` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: 몸으로 말해요와 상식 퀴즈 판"`

---

### Task 9: 이야기 나누기

**Files:**
- Create: `js/activities/story.js`
- Modify: `js/activities/index.js`, `css/app.css`, `scripts/e2e.mjs`

**Interfaces:**
- Consumes: 활동 공통 인터페이스, `step.content.story`
- Produces: `mount` (kind `story`)

- 동작(설계 5.4): 단계 `STORY_STAGES = [['STORY','이야기 읽기',60],['THINK','혼자 생각하기',30],['TALK','이야기 나누기',90],['PRESENT','발표하기',120],['EXTEND','생각 넓히기',90]]`
  - 단계마다 카운트다운(`tick`), 0이 되면 [다음 단계]가 깜빡임(자동 진행 없음). [◀ 이전 단계]·[다음 단계 ▶].
  - STORY: `story` 문장들을 크게. THINK: `mainQuestion`. TALK: `mainQuestion` + "짝·모둠과 이야기 나눠요". PRESENT: 🎲 발표자 뽑기(반 인원 숫자 입력, 기본 25, 5~40, 저장 안 함, 중복 없이 뽑고 다 뽑으면 다시 처음부터) + "발표한 모둠은 별판에서 ★를 눌러 주세요" 안내. EXTEND: `followUpQuestions`.
  - [💡 힌트](`hint`)·[🌱 예시 생각](`sampleIdeas`, "정답이 아니에요" 표시)은 눌러야 보임.
  - [모두 ★] 버튼 → `awardAll` (guard)
- [ ] **Step 1: e2e 검사 추가** — g3-lively 이야기: 처음 화면에 이야기 첫 문장이 보임, [다음 단계]를 4번 → '생각 넓히기', 발표자 뽑기를 반 인원 3으로 4번 → 앞의 3번은 서로 다른 번호, [모두 ★] 더블클릭 → 합계 +모둠 수만큼 한 번
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: 이야기 나누기"`

---

### Task 10: 따라 그리기와 꾸미기

**Files:**
- Create: `js/activities/draw.js`
- Modify: `js/activities/index.js`, `css/app.css`, `scripts/e2e.mjs`

**Interfaces:**
- Consumes: 활동 공통 인터페이스, `step.content.drawing`(`sec`·`totalSec` 포함), `step.content.decorate`
- Produces: `mount` (kind `draw`)

- 동작(설계 5.5):
  - 준비: 그림 제목, `paper`(세로/가로) 그림 표시, `setupSay` 크게, [▶ 그리기 시작]
  - 단계: SVG(`viewBox`)에 앞 단계 선은 연한 회색, 이번 단계 선은 굵은 강조색으로 `stroke-dashoffset` 애니메이션(500~1600ms), `teacherSay`와 `label`을 크게, "k / n" 표시. 단계 시간 `drawing.sec[k]`초가 `tick`으로 줄고 0이 되면 **다음 단계로 저절로**(이 활동 안의 자동 진행은 설계 5.5가 허용). [◀ 이전]·[다음 ▶]으로 조절.
  - 마지막 단계 뒤 색칠: `coloringSeconds` 카운트다운, 완성 그림 표시.
  - 색칠이 끝나면 꾸미기: `decorate` 문구를 크게, 순서 남은 시간 동안 유지.
  - [모두 ★] → `awardAll` (guard)
  - 빠른 깜빡임 없음. `prefers-reduced-motion`이면 선 애니메이션 없이 바로 표시.
- [ ] **Step 1: e2e 검사 추가** — g3-calm 그리기(페이지를 열기 전에 `page.clock.install()`): [그리기 시작] 후 ⏸ 상태로 `page.clock.fastForward(30000)` → 단계 번호 그대로; ▶ 후 `draw-next`를 단계 수만큼 → 색칠 화면; `fastForward(coloringSeconds×1000 + 1000)` → 꾸미기 문구가 보이고 `{title}` 글자가 없음
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat: 따라 그리기와 꾸미기"`

---

### Task 11: 진행 대본 인쇄 · 오프라인 · 글꼴 · 아이콘

**Files:**
- Create: `print.html`, `js/print.js`, `css/print.css`, `sw.js`, `manifest.json`, `favicon.svg`, `assets/fonts/*`(짬짬이 `game/assets/fonts/`에서 복사: `PretendardVariable.subset.woff2`, `coverage.txt`, `LICENSE.txt`), `scripts/check-font-coverage.mjs`(짬짬이 `game/scripts/check-font-coverage.mjs`를 복사해 `SKIP_DIRS`에 `tests`, `.cache`, `.superpowers` 추가)
- Modify: `index.html`(서비스 워커 등록, manifest·favicon 링크), `scripts/e2e.mjs`
- Test: `tests/sw.test.mjs`

**Interfaces:**
- Consumes: `buildScript` (Task 5), `buildPlan`, `loadData`
- Produces: `sw.js` 맨 위의 `const ASSETS = [ './index.html', ... ];`(문자열 리터럴만, 모두 `./`로 시작. 검사는 파일을 텍스트로 읽어 이 배열 안의 따옴표 문자열을 뽑는다), 캐시 이름 `'ttalkkak-bogyul-v1'`

- 인쇄(설계 9절): `print.html?grade=3&flow=lively` → 그 세트로 `buildPlan`(씨앗은 `Date.now()`) → `buildScript` → A4 한 장. 순서별 칸에 분·제목·진행 방법, 문제와 정답(작은 글씨), 몸으로 말해요 낱말 목록, 이야기 본문과 질문, 그리기 단계별 작은 SVG(누적) + 꾸미기 문구, 아래에 `tally`. 상단에 [🖨 인쇄] 버튼(인쇄할 때는 숨김). 내용이 넘치면 글자를 줄이지 말고 문항 수를 줄인다(word·quiz 10→8, gesture 15→12).
- 서비스 워커: 설치 때 `ASSETS` 전부를 캐시, 요청은 캐시 먼저 응답하고 뒤에서 새로 받아 갱신(stale-while-revalidate). 다른 출처 요청은 건드리지 않음.
- 글꼴: `@font-face`로 서브셋을 쓰고 뒤에 시스템 글꼴. `check-font-coverage`가 빠진 글자를 알리면 **문구를 바꾸는 것을 먼저** 하고, 안 되면 스크립트 머리말의 절차로 서브셋을 다시 만든다.
- 아이콘: 둥근 사각형 + "딸깍" 손가락 클릭 모양, 짬짬이 색과 겹치지 않는 색(디자인은 실행자 몫).
- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/sw.test.mjs`: `ASSETS`의 모든 경로가 실제로 있고, `index.html`·`print.html`·`manifest.json`·`favicon.svg`와 `js/`·`css/`·`data/`·`assets/` 아래 모든 파일이 `ASSETS`에 있음
- [ ] **Step 2: e2e 검사 추가** — 12세트 모두 `print.html`을 열어 `page.pdf({format:'A4'})` → 페이지 1장(PDF 바이트에서 `/\/Type\s*\/Page[^s]/g` 개수가 1); 한 번 열고 `navigator.serviceWorker.ready`를 기다린 뒤 `context.setOffline(true)`로 다시 열어도 첫 화면과 g1-lively 첫 순서가 뜸
- [ ] **Step 3: 실패 확인** — `node --test tests/sw.test.mjs`, `node scripts/e2e.mjs` → FAIL
- [ ] **Step 4: 구현**
- [ ] **Step 5: 통과 확인** — `npm test`(검사 + 자료 검증 + 글꼴 검사) → PASS, `node scripts/e2e.mjs` → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat: 진행 대본 인쇄·오프라인·글꼴·아이콘"`

---

### Task 12: 12세트 전체 브라우저 검사 · 화면 크기 · CI · README

**Files:**
- Modify: `scripts/e2e.mjs`, `README.md`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: e2e를 12세트 × 모둠 6개로 넓히기** — 세트마다 `runSet` 끝까지, 콘솔 오류 0, 축하 화면 합계가 진행 중 준 별 수와 같음.
- [ ] **Step 2: 화면 크기 검사 추가** (Review Focus 2) — 1366×768과 1280×720에서 g6-lively를 모둠 8개로: 활동 화면마다 `document.scrollingElement.scrollHeight <= innerHeight + 1`, 별판 칩들이 한 줄(모든 칩의 `offsetTop` 같음), 규칙 안내 본문 글자 크기가 1920×1080에서 32px 이상.
- [ ] **Step 3: 실패하면 고치고 통과 확인** — `node scripts/e2e.mjs` → PASS. 1920×1080 화면 몇 장을 `.cache/shots/`에 찍어 두고 눈으로 본다(뒷자리 가독성).
- [ ] **Step 4: CI** — `.github/workflows/ci.yml`: push·pull_request에서 Node 24, `npm ci`, `npm test`, `npx playwright install --with-deps chromium`, `npm run e2e`.
- [ ] **Step 5: README** — 무엇인지, 쓰는 법(링크 열기 → 학년 → 시작), 개발(`npm run serve`, `npm test`, `npm run e2e`, `npm run import`), 자료 출처(짬짬이)와 글꼴 라이선스.
- [ ] **Step 6: 커밋** — `git commit -m "test: 12세트 브라우저 검사·화면 크기 검사·CI"`

---

### Task 14: 따라 그리기 → 인물 퀴즈 (2026-11-11 변경)

설계 문서 맨 위 "변경"과 5.5절. 따라 그리기는 종이·연필이 필요해 뺀다. 만든 코드는 `7fa2419`에 남아 있다.

**Files:**
- Create: `js/activities/person.js`, `credits.html`, `js/credits.js`, `data/people.json`·`assets/people/*.webp`(가져오기 생성물)
- Delete: `js/activities/draw.js`, `js/core/drawing.js`, `data/drawings.json`, `data/decorate.json`, `tests/drawing.test.mjs`, 그리기 CSS
- Modify: `scripts/import-jjam.mjs`, `scripts/validate-data.mjs`, `js/core/{flows,plan,data,rules,script}.js`, `js/activities/{index,word}.js`, `js/ui/{start,runner}.js`, `js/print.js`, `css/{app,print}.css`, `data/sets.json`, `sw.js`, `scripts/e2e.mjs`, `README.md`, 단위 검사들

**Interfaces:**
- Produces:
  - `filterPeople(items): Item[]` (import-jjam) — `type==='person'`이고 주제가 가수·배우·예능인이거나 `level==='easy'`.
  - `data/people.json` = `{ source, people: Person[] }`, `Person` = 짬짬이 낱말 필드 + `photo: { file: 'assets/people/<id>.webp', author, license, source }`. 사진은 `word/assets/people/`에서 같은 경로로 복사한다.
  - `loadData`·`readDataDir` → `{ words, stories, people, quiz, sets }`
  - `FLOWS`: lively `greet 3, word 10, team 10, person 8, story 7, celebrate 2`, calm `greet 3, story 7, word 10, team 10, person 8, celebrate 2`
  - `BAND_PERSON_LEVELS = { lower: ['easy'], middle: ['easy','normal'], upper: ['easy','normal','hard'] }`
  - `poolFor('person', set, data)`, 계획의 person 순서 `content = { deck }`, 제목 '인물 퀴즈'
  - 활동 kind `person`: 말놀이와 같은 버튼(`hint`·`reveal`·`correct`·`pass`·`next-item`)에 사진(`[data-photo]`, `alt=""`)과 정답 뒤 사진 출처(`[data-credit]`)
  - 대본 person 섹션: `items: {q: 힌트, a: 이름}[]` 10개, `LEVELS`에 `person: 10/8/6`

- [ ] **Step 1: 실패하는 검사** — import(`filterPeople`), plan(흐름 순서·학년대 난이도·덱), validate(인물 풀 ≥ 20, 사진 파일·저작자·라이선스·원본 주소), rules(person 규칙, 준비물 없음), script(person 섹션 10개). `node --test "tests/*.test.mjs"` → FAIL
- [ ] **Step 2: 구현** — 위 Interfaces. `node scripts/import-jjam.mjs --no-pull`(이미 받은 사본 그대로)로 `people.json`과 사진을 만든다.
- [ ] **Step 3: e2e** — ACT_STEPS·SWEEP에 person, 그리기 검사를 인물 퀴즈 검사(사진이 실제로 뜸·alt 비어 있음·[맞혔어요] 두 번에 +1·정답 뒤 사진 출처·출처 페이지 299줄)로, 오프라인에서 인물 사진이 뜨는지.
- [ ] **Step 4: 전체 확인** — `npm test`, `npm run stamp`, `npm run e2e` 전부 통과(진행 대본 12세트 A4 한 장 포함).
- [ ] **Step 5: 커밋** — `git commit -m "feat: 따라 그리기 대신 인물 퀴즈"`

---

### Task 13: 발행 (🔶 사용자 확인 필수)

이 작업은 바깥에 공개되는 일이다. **시작 전에 사용자에게 저장소 이름(`shway81-droid/ttalkkak-bogyul`)과 공개 발행을 확인받는다.** Task 3 Step 8의 12세트 확인도 끝나 있어야 한다.

- [ ] **Step 1: 확인 받기** — 사용자가 "발행해도 된다"고 답한 뒤에만 진행.
- [ ] **Step 2: 저장소 만들고 올리기** — `gh repo create shway81-droid/ttalkkak-bogyul --public --source . --push`. `.github/workflows` 푸시가 거부되면 gh 토큰에 `workflow` 권한이 없는 것이다(실패사전) — 사용자에게 `gh auth refresh -s workflow`를 안내한다.
- [ ] **Step 3: Pages 켜기** — `gh api -X POST repos/shway81-droid/ttalkkak-bogyul/pages -f "source[branch]=main" -f "source[path]=/"`
- [ ] **Step 4: 확인** — 몇 분 뒤 `curl --ssl-no-revoke -s -o /dev/null -w "%{http_code}" https://shway81-droid.github.io/ttalkkak-bogyul/` → `200`; 같은 주소로 e2e의 g3-lively 하나를 돌려 PASS. CI가 초록인지 `gh run list` 로 확인.
- [ ] **Step 5: 사용자에게 주소 전달**
