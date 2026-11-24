// 자료 읽기. 앱 안에서 쓰는 모양은 {words, stories, people, quiz, sets}
// (scripts/validate-data.mjs 의 readDataDir 와 같은 모양).
// 첫 화면은 학년·흐름 목록(sets.json, 2KB)만 있으면 그린다(loadSets). 나머지 자료(약 1MB)는
// 첫 화면을 그리는 동안 뒤에서 받는다(loadData 에 받는 중인 sets 를 넘기면 sets.json 을 다시 받지 않는다).

async function readJson(fetchFn, base, name) {
  const res = await fetchFn(`${base}${name}.json`);
  if (!res.ok) throw new Error(`${name}.json 을 읽지 못했습니다 (${res.status})`);
  return res.json();
}

/** 학년·흐름 목록(sets) */
export async function loadSets(fetchFn = fetch, base = 'data/') {
  // 단일 HTML 파일(scripts/build-single.mjs)은 자료를 파일 안에 이미 담아 둔다
  if (globalThis.__BOGYUL_DATA__) return globalThis.__BOGYUL_DATA__.sets;
  return (await readJson(fetchFn, base, 'sets')).sets;
}

/** 모든 자료. sets 는 이미 받는 중인 것(loadSets 의 약속)을 넘기면 그것을 쓴다. */
export async function loadData(fetchFn = fetch, base = 'data/', sets = null) {
  if (globalThis.__BOGYUL_DATA__) return globalThis.__BOGYUL_DATA__;
  const [words, stories, people, quiz, setList] = await Promise.all([
    readJson(fetchFn, base, 'words'),
    readJson(fetchFn, base, 'stories'),
    readJson(fetchFn, base, 'people'),
    readJson(fetchFn, base, 'quiz'),
    sets ?? loadSets(fetchFn, base),
  ]);
  return {
    words: words.items,
    stories: stories.stories,
    people: people.people,
    quiz: quiz.items,
    sets: setList,
  };
}
