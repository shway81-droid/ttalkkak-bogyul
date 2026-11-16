// 짬짬이 저장소에서 낱말·이야기·인물·퀴즈 자료를 가져와 data/ 에 저장하고, 인물 사진을 assets/people/ 에 복사한다.
// 사용자의 로컬 jjam-classroom 폴더는 건드리지 않고, .cache/jjam-classroom 복제본만 읽는다.
// --no-pull: 이미 받은 복제본을 그대로 쓴다(원본을 새로 받지 않음).
//
// 도중에 실패해도 지금 자료가 반쯤 바뀐 채 남지 않게:
//   1) 원본에서 자료를 모두 읽고 사진 경로·파일을 먼저 확인한다(아직 아무것도 바꾸지 않음).
//   2) 새 자료(data/*.json)와 줄인 사진을 임시 폴더(.cache/import-stage)에 만들고, 자료 검증(validate-data)을 거친다.
//   3) 모두 통과하면 그때 data/*.json 과 assets/people/ 을 한꺼번에 바꿔 넣는다.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, renameSync, copyFileSync } from 'node:fs';
import { shrinkPhoto } from './shrink-photos.mjs';
import { validateData, readDataDir } from './validate-data.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/shway81-droid/jjam-classroom.git';
const CACHE = join(ROOT, '.cache', 'jjam-classroom');

export const WORD_TYPES_KEPT = ['choseong', 'proverb', 'riddle', 'idiom', 'fourword', 'opposite', 'mimetic', 'scramble', 'spelling', 'gesture'];

const BAND_TOPICS = {
  lower: ['animal-quiz', 'vehicle-quiz', 'food-name', 'clothing-quiz', 'stationery-quiz', 'household-quiz', 'drink-snack', 'bird-quiz', 'building-quiz', 'tool-quiz', 'sea-life', 'insect-quiz', 'family-quiz', 'safety-quiz', 'health-habit', 'manner-quiz', 'weather-quiz', 'rainbow-quiz', 'sense-quiz', 'dino-quiz', 'fairytale-quiz', 'folktale-quiz', 'aesop-quiz', 'riddle-quiz', 'job-do', 'town-place', 'habitat-quiz'],
  middle: ['plant-quiz', 'plant-part-quiz', 'science-life', 'water-state-quiz', 'magnet-quiz', 'korean-food', 'korea-culture', 'nationalday-quiz', 'local-specialty', 'landform-quiz', 'province-quiz', 'korea-geo', 'punctuation-quiz', 'measure-unit', 'eco-save-quiz', 'economy-quiz', 'tech-device', 'hero-figure', 'money-count', 'analogy-quiz'],
  upper: ['science-quiz', 'space-quiz', 'korea-history', 'heritage-quiz', 'world-hero', 'world-culture', 'world-landmark', 'food-country', 'continent-quiz', 'sentence-type-quiz', 'magnet-quiz', 'measure-unit', 'economy-quiz'],
};

/** 주제 → 그 주제를 쓰는 학년대 배열 */
export const QUIZ_TOPICS = {};
for (const [band, topics] of Object.entries(BAND_TOPICS)) {
  for (const t of topics) (QUIZ_TOPICS[t] ||= []).push(band);
}

const EMOJI_RE = /^<span class=['"]q-emoji['"]>([\s\S]*?)<\/span><br\s*\/?>/;
const TAG_RE = /<[^>]+>/;

/** game.js 소스에서 한 줄짜리 { q, a, o } 문항을 읽는다 */
export function parseQuizGame(source, topic) {
  const out = [];
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^\s*(\{\s*q\s*:.*\})\s*,?\s*$/);
    if (!m) continue;
    let obj;
    try {
      obj = runInNewContext('(' + m[1] + ')', {});
    } catch {
      continue;
    }
    if (typeof obj.q !== 'string' || typeof obj.a !== 'string' || !Array.isArray(obj.o) || obj.o.length !== 3) continue;
    let q = obj.q;
    let emoji;
    const em = q.match(EMOJI_RE);
    if (em) {
      emoji = em[1].trim();
      q = q.slice(em[0].length);
    }
    q = q.trim();
    if (TAG_RE.test(q) || TAG_RE.test(obj.a) || obj.o.some((x) => typeof x !== 'string' || TAG_RE.test(x))) continue;
    const item = { id: `${topic}-${out.length + 1}`, topic, bands: QUIZ_TOPICS[topic], q };
    if (emoji) item.emoji = emoji;
    item.a = obj.a;
    item.o = [...obj.o]; // vm 안에서 만든 배열을 이쪽 Array 로 옮긴다
    out.push(item);
  }
  return out;
}

/** 딸깍 보결에서 쓰는 낱말 유형만 남긴다 */
export function filterWords(items) {
  return items.filter((w) => WORD_TYPES_KEPT.includes(w.type));
}

/** 인물 퀴즈에 쓰는 주제: 이 주제는 모든 난이도, 나머지 인물은 쉬움(easy)만 (2026-11-11 사용자 결정) */
export const PERSON_TOPICS_ALL_LEVELS = ['가수', '배우', '예능인'];

export const PHOTO_FILE_RE = /^assets\/people\/[\w-]+\.webp$/;

/** 인물 퀴즈 후보: 가수·배우·예능인은 모두, 역사 인물·과학자·예술가·운동선수는 쉬움만 */
export function filterPeople(items) {
  return items.filter((w) => w.type === 'person' && (PERSON_TOPICS_ALL_LEVELS.includes(w.topic) || w.level === 'easy'));
}

/**
 * 짬짬이 자료에서 "…"로 잘린 사진 저작자 이름의 전체 이름(id → 이름).
 * 위키미디어 공용 파일 정보(Artist)에서 확인했다(2026-11-11). 확인 글(Verification: …)은 이름이 아니라 뺐다.
 * 자료 검증이 잘린 이름을 막으므로, 새로 잘린 이름이 들어오면 여기에 더한다.
 */
export const AUTHOR_FULL = {
  'person-002': 'Korea.net / Korean Culture and Information Service (Jeon Han)',
  'person-068': 'KOCIS (Korean Culture and Information Service) Official Photographer: Kim Sunjoo',
  'person-110': 'Louis Bachrach, Bachrach Studios, restored by Michel Vuijlsteke',
  'person-122': 'MetalGearLiquid, based on File:Steve_Jobs_Headshot_2010-CROP.jpg made by Matt Yohe',
  'person-193': 'Official YouTube account of 식신로드 (Gourmet Road)',
  'person-267': 'Korea.net / Korean Culture and Information Service (Jeon Han)',
  'person-323': 'lotteent (official Lotte Entertainment YouTube account)',
  'person-348': 'Korea.net / Korean Culture and Information Service (Jeon Han)',
  'person-359': 'lotteent (official Lotte Entertainment YouTube account)',
  'person-373': 'Official YouTube account of 식신로드 (Gourmet Road)',
};

/** 잘린 저작자 이름을 전체 이름으로 바꾼 새 배열(원본은 그대로) */
export function withFullAuthors(people) {
  return people.map((p) => (AUTHOR_FULL[p.id] ? { ...p, photo: { ...p.photo, author: AUTHOR_FULL[p.id] } } : p));
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function syncCache(pull = true) {
  if (!existsSync(CACHE)) {
    mkdirSync(dirname(CACHE), { recursive: true });
    git('clone', '--depth', '1', REPO, CACHE);
  } else if (pull) {
    git('-C', CACHE, 'pull', '--ff-only');
  }
  return git('-C', CACHE, 'rev-parse', 'HEAD');
}

const readJson = (p) => JSON.parse(readFileSync(join(CACHE, p), 'utf8'));
const jsonText = (obj) => JSON.stringify(obj, null, 1) + '\n';

/** 가져올 자료 파일(data/ 아래). sets.json 은 이 저장소에서 쓰는 것이라 가져오지 않는다 */
export const IMPORTED_JSON = ['words.json', 'people.json', 'stories.json', 'quiz.json'];

/** 사진 경로가 올바르고 원본 파일이 있는지 먼저 본다. 문제 목록(빈 배열이면 통과) */
export function checkPhotoSources(people, srcDir) {
  const errs = [];
  for (const p of people) {
    const file = p.photo?.file || '';
    if (!PHOTO_FILE_RE.test(file)) errs.push(`${p.id}: 사진 경로가 이상합니다 (${file})`);
    else if (!existsSync(join(srcDir, file))) errs.push(`${p.id}: 원본에 사진 파일이 없습니다 (${file})`);
  }
  return errs;
}

/**
 * 임시 폴더 stage 에 새 자료를 만든다: stage/data/*.json, stage/assets/people/*.webp.
 * 실패하면 예외를 던진다(지금 자료는 그대로). shrink(src, dst) 는 사진 한 장을 줄여 쓰는 함수.
 */
export async function buildStage({ stage, files, people, srcDir, shrink = shrinkPhoto }) {
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, 'data'), { recursive: true });
  mkdirSync(join(stage, 'assets', 'people'), { recursive: true });
  for (const [name, obj] of Object.entries(files)) writeFileSync(join(stage, 'data', name), jsonText(obj));
  for (const p of people) await shrink(join(srcDir, p.photo.file), join(stage, p.photo.file));
}

/**
 * 임시 폴더의 새 자료를 root 에 바꿔 넣는다. 사진 폴더는 통째로 이름을 바꿔 끼우므로
 * 빠진 인물의 옛 사진이 남지 않는다. 자료 파일은 하나씩 이름을 바꿔 넣는다(같은 디스크라 바로 끝남).
 */
export function commitStage(stage, root, names = IMPORTED_JSON) {
  const photoDir = join(root, 'assets', 'people');
  const old = `${stage}-old-people`;
  rmSync(old, { recursive: true, force: true });
  mkdirSync(join(root, 'assets'), { recursive: true });
  if (existsSync(photoDir)) renameSync(photoDir, old);
  try {
    renameSync(join(stage, 'assets', 'people'), photoDir);
  } catch (e) {
    if (existsSync(old)) renameSync(old, photoDir); // 되돌려 놓는다
    throw e;
  }
  mkdirSync(join(root, 'data'), { recursive: true });
  for (const name of names) renameSync(join(stage, 'data', name), join(root, 'data', name));
  rmSync(old, { recursive: true, force: true });
  rmSync(stage, { recursive: true, force: true });
}

function countBy(items, keyFn) {
  const out = {};
  for (const it of items) {
    for (const k of [].concat(keyFn(it))) out[k] = (out[k] || 0) + 1;
  }
  return out;
}

async function main() {
  const commit = syncCache(!process.argv.includes('--no-pull'));
  const source = { repo: REPO.replace(/\.git$/, ''), commit };

  // 1) 원본에서 모두 읽는다(아직 아무것도 바꾸지 않음)
  const wordItems = readJson('word/data/words.json').items;
  const words = filterWords(wordItems);
  // 인물 퀴즈: 사진은 원본과 같은 경로(assets/people/…)로 복사하며 세로 540px 로 줄인다
  // (scripts/shrink-photos.mjs — TV 에서 차이가 거의 없고 용량은 절반).
  const people = withFullAuthors(filterPeople(wordItems));
  const srcDir = join(CACHE, 'word');
  const photoErrs = checkPhotoSources(people, srcDir);
  if (photoErrs.length) throw new Error(`사진 확인 실패 — 지금 자료는 그대로 둡니다:\n${photoErrs.join('\n')}`);

  const stories = readJson('story/data/stories.json').stories.filter((s) => s.sensitivity === 'low');

  const quiz = [];
  const gamesDir = join(CACHE, 'quiz', 'games');
  const available = new Set(readdirSync(gamesDir));
  for (const topic of Object.keys(QUIZ_TOPICS)) {
    if (!available.has(topic)) {
      console.warn(`경고: 퀴즈 주제 ${topic} 이 원본에 없습니다`);
      continue;
    }
    const items = parseQuizGame(readFileSync(join(gamesDir, topic, 'game.js'), 'utf8'), topic);
    if (items.length === 0) console.warn(`경고: 퀴즈 주제 ${topic} 에서 문항 0개`);
    quiz.push(...items);
  }

  // 2) 임시 폴더에 새 자료를 만들고 검증한다
  const stage = join(ROOT, '.cache', 'import-stage');
  await buildStage({
    stage,
    srcDir,
    people,
    files: {
      'words.json': { source, items: words },
      'people.json': { source, people },
      'stories.json': { source, stories },
      'quiz.json': { source, items: quiz },
    },
  });
  copyFileSync(join(ROOT, 'data', 'sets.json'), join(stage, 'data', 'sets.json'));
  const errs = validateData(
    readDataDir(join(stage, 'data')),
    (p) => existsSync(join(stage, p)),
    (p) => createHash('sha256').update(readFileSync(join(stage, p))).digest('hex'),
  );
  if (errs.length) throw new Error(`자료 검증 실패 — 지금 자료는 그대로 둡니다(새 자료: ${stage}):\n${errs.join('\n')}`);

  // 3) 한꺼번에 바꿔 넣는다
  commitStage(stage, ROOT);

  console.log(`원본 커밋 ${commit.slice(0, 7)}`);
  console.log('낱말 유형·난이도:', JSON.stringify(countBy(words, (w) => `${w.type}/${w.level}`)));
  console.log('이야기 학년대:', JSON.stringify(countBy(stories, (s) => s.grades || s.grade || '?')));
  console.log('인물 주제/난이도:', JSON.stringify(countBy(people, (p) => `${p.topic}/${p.level}`)));
  console.log('퀴즈 학년대:', JSON.stringify(countBy(quiz, (q) => q.bands)));
  console.log('화면 파일이 바뀌었으면 npm run stamp 를 돌려 주세요.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
