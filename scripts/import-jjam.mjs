// 짬짬이 저장소에서 낱말·이야기·인물·퀴즈 자료를 가져와 data/ 에 저장하고, 인물 사진을 assets/people/ 에 복사한다.
// 사용자의 로컬 jjam-classroom 폴더는 건드리지 않고, .cache/jjam-classroom 복제본만 읽는다.
// --no-pull: 이미 받은 복제본을 그대로 쓴다(원본을 새로 받지 않음).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
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
const writeJson = (name, obj) => writeFileSync(join(ROOT, 'data', name), JSON.stringify(obj, null, 1) + '\n');

function countBy(items, keyFn) {
  const out = {};
  for (const it of items) {
    for (const k of [].concat(keyFn(it))) out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function main() {
  const commit = syncCache(!process.argv.includes('--no-pull'));
  const source = { repo: REPO.replace(/\.git$/, ''), commit };
  mkdirSync(join(ROOT, 'data'), { recursive: true });

  const wordItems = readJson('word/data/words.json').items;
  const words = filterWords(wordItems);
  writeJson('words.json', { source, items: words });

  // 인물 퀴즈: 사진은 원본과 같은 경로(assets/people/…)로 복사한다. 빠진 인물의 옛 사진이 남지 않게 폴더를 새로 만든다.
  const people = filterPeople(wordItems);
  const photoDir = join(ROOT, 'assets', 'people');
  rmSync(photoDir, { recursive: true, force: true });
  mkdirSync(photoDir, { recursive: true });
  for (const p of people) {
    if (!PHOTO_FILE_RE.test(p.photo?.file || '')) throw new Error(`${p.id}: 사진 경로가 이상합니다 (${p.photo?.file})`);
    copyFileSync(join(CACHE, 'word', p.photo.file), join(ROOT, p.photo.file));
  }
  writeJson('people.json', { source, people });

  const stories = readJson('story/data/stories.json').stories.filter((s) => s.sensitivity === 'low');
  writeJson('stories.json', { source, stories });

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
  writeJson('quiz.json', { source, items: quiz });

  console.log(`원본 커밋 ${commit.slice(0, 7)}`);
  console.log('낱말 유형·난이도:', JSON.stringify(countBy(words, (w) => `${w.type}/${w.level}`)));
  console.log('이야기 학년대:', JSON.stringify(countBy(stories, (s) => s.grades || s.grade || '?')));
  console.log('인물 주제/난이도:', JSON.stringify(countBy(people, (p) => `${p.topic}/${p.level}`)));
  console.log('퀴즈 학년대:', JSON.stringify(countBy(quiz, (q) => q.bands)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
