// 자료 읽기. 앱 안에서 쓰는 모양은 {words, stories, people, quiz, sets}
// (scripts/validate-data.mjs 의 readDataDir 와 같은 모양).

const FILES = ['words', 'stories', 'people', 'quiz', 'sets'];

export async function loadData(fetchFn = fetch, base = 'data/') {
  const raw = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetchFn(`${base}${name}.json`);
      if (!res.ok) throw new Error(`${name}.json 을 읽지 못했습니다 (${res.status})`);
      return res.json();
    }),
  );
  const [words, stories, people, quiz, sets] = raw;
  return {
    words: words.items,
    stories: stories.stories,
    people: people.people,
    quiz: quiz.items,
    sets: sets.sets,
  };
}
