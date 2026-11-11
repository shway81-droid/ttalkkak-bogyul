// 40분 흐름 두 가지와 학년대.

export const FLOWS = {
  lively: {
    label: '신나게 열기',
    icon: '🎉',
    blurb: '말놀이·모둠 놀이로 신나게 시작해서, 이야기·따라 그리기로 차분하게 마칩니다.',
    slots: [['greet', 3], ['word', 10], ['team', 10], ['story', 7], ['draw', 8], ['celebrate', 2]],
  },
  calm: {
    label: '차분하게 열기',
    icon: '🍃',
    blurb: '따라 그리기·이야기로 차분하게 시작해서, 모둠 대항 놀이는 마지막 선물로 둡니다.',
    slots: [['greet', 3], ['draw', 8], ['story', 7], ['word', 10], ['team', 10], ['celebrate', 2]],
  },
};

/** 학년 → 학년대 (1·2 저, 3·4 중, 5·6 고) */
export function bandOf(grade) {
  if (grade <= 2) return 'lower';
  if (grade <= 4) return 'middle';
  return 'upper';
}

/** 학년대 → 따라 그리기 난이도 */
export const BAND_DRAW_LEVEL = { lower: 'easy', middle: 'normal', upper: 'hard' };
