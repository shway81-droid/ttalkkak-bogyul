// 말놀이 유형별 화면 제목과 아이에게 읽어 줄 안내.
// 제목은 짬짬이 말놀이와 같게 두고, 안내는 모둠이 의논해서 맞히는 방식에 맞췄다.

export const WORD_TYPES = {
  choseong: { title: 'ㄱㄴㄷ 초성퀴즈', ask: '초성을 보고 낱말을 맞혀요' },
  proverb: { title: '속담 이어말하기', ask: '앞부분을 보고 뒷부분을 말해요' },
  idiom: { title: '사자성어', ask: '뜻을 보고 사자성어를 맞혀요' },
  riddle: { title: '수수께끼', ask: '수수께끼의 답을 맞혀요' },
  fourword: { title: '4글자 이어말하기', ask: '앞 두 글자를 보고 뒤 두 글자를 말해요' },
  opposite: { title: '반대말 외치기', ask: '낱말을 보고 반대말을 말해요' },
  mimetic: { title: '흉내 내는 말', ask: '빈칸에 어울리는 소리나 모양을 말해요' },
  scramble: { title: '글자 뒤섞기', ask: '뒤섞인 글자를 바로 놓아 낱말을 맞혀요' },
  spelling: { title: '맞춤법 고치기', ask: '틀린 말을 바르게 고쳐 말해요' },
};
