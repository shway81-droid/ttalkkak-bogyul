import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuizGame, filterWords, QUIZ_TOPICS, WORD_TYPES_KEPT } from '../scripts/import-jjam.mjs';

const SAMPLE = "const Q = [\n  { q: \"<span class='q-emoji'>🚗</span><br>이 탈것의 이름은?\", a: \"자동차\", o: [\"경주용차\", \"여객선\", \"케이블카\"] },\n  { q: '물이 얼면?', a: '얼음', o: ['수증기','소금','모래'] },\n];";

test('parseQuizGame: 문항을 읽고 이모지를 떼어 낸다', () => {
  const items = parseQuizGame(SAMPLE, 'vehicle-quiz');
  assert.equal(items.length, 2);
  assert.equal(items[0].emoji, '🚗');
  assert.equal(items[0].q, '이 탈것의 이름은?');
  assert.equal(items[0].a, '자동차');
  assert.deepEqual(items[0].o, ['경주용차', '여객선', '케이블카']);
  assert.equal(items[0].topic, 'vehicle-quiz');
  assert.equal(items[0].id, 'vehicle-quiz-1');
  assert.deepEqual(items[0].bands, QUIZ_TOPICS['vehicle-quiz']);
  assert.equal('emoji' in items[1], false);
  assert.equal(items[1].q, '물이 얼면?');
  assert.equal(items[1].id, 'vehicle-quiz-2');
});

test('parseQuizGame: 다른 HTML 태그가 남는 문항은 버린다', () => {
  const src = "const Q = [\n  { q: '<b>굵게</b> 무엇?', a: '가', o: ['나','다','라'] },\n  { q: '보통 문항?', a: '가', o: ['나','다','라'] },\n];";
  const items = parseQuizGame(src, 'animal-quiz');
  assert.equal(items.length, 1);
  assert.equal(items[0].q, '보통 문항?');
});

test('QUIZ_TOPICS: 한 주제가 여러 학년대에 들 수 있다', () => {
  assert.deepEqual(QUIZ_TOPICS['vehicle-quiz'], ['lower']);
  assert.deepEqual(QUIZ_TOPICS['magnet-quiz'], ['middle', 'upper']);
});

test('filterWords: 쓰지 않는 유형은 버린다', () => {
  const items = ['person', 'chain', 'relay', 'urimal', ...WORD_TYPES_KEPT].map((type, i) => ({ id: `w${i}`, type }));
  const kept = filterWords(items);
  assert.deepEqual(kept.map((w) => w.type), WORD_TYPES_KEPT);
});

test('filterPeople: 가수·배우·예능인은 모두, 다른 인물은 쉬움만 남긴다', async () => {
  const { filterPeople } = await import('../scripts/import-jjam.mjs');
  const items = [
    { id: 'a', type: 'person', topic: '가수', level: 'hard' },
    { id: 'b', type: 'person', topic: '배우', level: 'normal' },
    { id: 'c', type: 'person', topic: '예능인', level: 'hard' },
    { id: 'd', type: 'person', topic: '과학자', level: 'easy' },
    { id: 'e', type: 'person', topic: '역사 인물', level: 'normal' },
    { id: 'f', type: 'person', topic: '운동선수', level: 'hard' },
    { id: 'g', type: 'riddle', topic: '가수', level: 'easy' },
  ];
  assert.deepEqual(filterPeople(items).map((p) => p.id), ['a', 'b', 'c', 'd']);
});

test('withFullAuthors: 짬짬이 자료에서 잘린 저작자 이름을 전체 이름으로 바꾸고 원본은 그대로 둔다', async () => {
  const { withFullAuthors, AUTHOR_FULL } = await import('../scripts/import-jjam.mjs');
  const src = [
    { id: 'person-002', photo: { author: 'Korea.net / Korean Culture and Information Service (Jeon …', license: 'CC BY-SA 2.0' } },
    { id: 'person-001', photo: { author: '티비텐 TV10', license: 'CC BY 3.0' } },
  ];
  const out = withFullAuthors(src);
  assert.equal(out[0].photo.author, 'Korea.net / Korean Culture and Information Service (Jeon Han)');
  assert.equal(out[0].photo.license, 'CC BY-SA 2.0');
  assert.equal(out[1].photo.author, '티비텐 TV10');
  assert.equal(src[0].photo.author.endsWith('…'), true);
  for (const name of Object.values(AUTHOR_FULL)) assert.ok(!/(…|\.\.\.)\s*$/.test(name), name);
});

// 가져오기 도중 실패해도 지금 자료가 반쯤 바뀐 채 남지 않아야 한다
test('checkPhotoSources: 이상한 경로·원본에 없는 사진을 먼저 잡는다', async () => {
  const { checkPhotoSources } = await import('../scripts/import-jjam.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const src = mkdtempSync(join(tmpdir(), 'imp-src-'));
  mkdirSync(join(src, 'assets', 'people'), { recursive: true });
  writeFileSync(join(src, 'assets', 'people', 'p-1.webp'), 'x');
  const errs = checkPhotoSources([
    { id: 'a', photo: { file: 'assets/people/p-1.webp' } },
    { id: 'b', photo: { file: 'assets/people/p-2.webp' } },
    { id: 'c', photo: { file: '../etc/passwd' } },
  ], src);
  assert.equal(errs.length, 2);
  assert.ok(errs[0].startsWith('b:') && errs[1].startsWith('c:'));
});

test('buildStage 가 도중에 실패하면 지금 자료·사진은 그대로, 성공하면 commitStage 가 한꺼번에 바꾼다', async () => {
  const { buildStage, commitStage } = await import('../scripts/import-jjam.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const root = mkdtempSync(join(tmpdir(), 'imp-root-'));
  const src = mkdtempSync(join(tmpdir(), 'imp-src-'));
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'assets', 'people'), { recursive: true });
  writeFileSync(join(root, 'data', 'people.json'), 'OLD');
  writeFileSync(join(root, 'assets', 'people', 'old.webp'), 'old');
  mkdirSync(join(src, 'assets', 'people'), { recursive: true });
  for (const n of [1, 2, 3]) writeFileSync(join(src, 'assets', 'people', `p-${n}.webp`), `new${n}`);
  const people = [1, 2, 3].map((n) => ({ id: `p${n}`, photo: { file: `assets/people/p-${n}.webp` } }));
  const stage = join(root, '.cache', 'stage');
  const copy = async (a, b) => writeFileSync(b, readFileSync(a));

  let n = 0;
  const failing = async (a, b) => {
    if (++n === 2) throw new Error('sharp 오류');
    await copy(a, b);
  };
  await assert.rejects(buildStage({ stage, srcDir: src, people, files: { 'people.json': { people } }, shrink: failing }));
  assert.equal(readFileSync(join(root, 'data', 'people.json'), 'utf8'), 'OLD');
  assert.deepEqual(readdirSync(join(root, 'assets', 'people')), ['old.webp']);

  await buildStage({ stage, srcDir: src, people, files: { 'people.json': { people } }, shrink: copy });
  commitStage(stage, root, ['people.json']);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'data', 'people.json'), 'utf8')).people.length, 3);
  assert.deepEqual(readdirSync(join(root, 'assets', 'people')).sort(), ['p-1.webp', 'p-2.webp', 'p-3.webp']);
  assert.equal(existsSync(stage), false);
});
