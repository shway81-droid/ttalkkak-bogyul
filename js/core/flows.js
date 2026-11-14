// 40분 흐름 두 가지와 학년대.
// 2026-11-13: 말놀이가 어려운 편이라 인물 퀴즈와 자리를 바꿔 뒤로 보냄(사용자 결정).

export const FLOWS = {
  lively: {
    label: '신나게 열기',
    icon: 'zap', // 루시드 아이콘 이름
    blurb: '놀이로 신나게 시작해서, 이야기로 차분하게 마칩니다.',
    slots: [['greet', 3], ['person', 8], ['team', 10], ['word', 10], ['story', 7], ['celebrate', 2]],
  },
  calm: {
    label: '차분하게 열기',
    icon: 'leaf',
    blurb: '이야기로 차분하게 시작해서, 모둠 대항 놀이는 마지막 선물로 둡니다.',
    slots: [['greet', 3], ['story', 7], ['person', 8], ['team', 10], ['word', 10], ['celebrate', 2]],
  },
};

/** 학년 → 학년대 (1·2 저, 3·4 중, 5·6 고) */
export function bandOf(grade) {
  if (grade <= 2) return 'lower';
  if (grade <= 4) return 'middle';
  return 'upper';
}

/** 학년대 → 인물 퀴즈 난이도 */
export const BAND_PERSON_LEVELS = { lower: ['easy'], middle: ['easy', 'normal'], upper: ['easy', 'normal', 'hard'] };
