# 딸깍 보결 1분 소개 영상

첫 화면의 **[처음이신가요? 1분 소개 영상 보기]** 링크가 여는 영상의 원본입니다. [Remotion](https://www.remotion.dev)으로 만듭니다.

완성본: [`ttalkkak-bogyul-intro.mp4`](ttalkkak-bogyul-intro.mp4) (약 9.6MB)

- 1920×1080 · 30fps · 약 55초 · 배경음악 + 효과음(내레이션 없음), 음량 약 -16 LUFS(유튜브 권장)
- 배경음악은 `scripts/make-bgm.mjs` 가 **코드로 직접 만든 곡**입니다(밝은 C장조 104 BPM, 패드·마림바·종소리·베이스·가벼운 드럼). 남의 곡을 쓰지 않아 유튜브 저작권(Content ID) 걱정이 없습니다.
- 장면: 고민 → 제목 → 첫 화면(학년·흐름·모둠 수·시작) → 40분 흐름 → 활동 맛보기(인물 퀴즈·몸으로 말해요·말놀이·이야기) → 우리 반 별 → 실시간 정답 창 → 어느 교실에서든 → 마무리
- 화면은 실제 앱을 찍어서 씁니다. 유튜브에 공개되므로 **인물 퀴즈 사진은 흐리게** 찍습니다.

## 만들기

```bash
cd video
npm install
npm run prep     # 글꼴 복사 · 효과음 받기 · 배경음악 만들기 · 앱 화면 찍기 (public/ 아래, 저장소에는 넣지 않음)
npm run render   # → ttalkkak-bogyul-intro.mp4 (저장소에 넣어 두는 완성본)
```

- 미리 보며 고치기: `npm run dev` (Remotion Studio)
- 앱 화면이 바뀌면 `npm run prep` 을 다시 돌린 뒤 렌더합니다.
- Playwright 브라우저가 다른 곳에 있으면 `CHROME_PATH=/경로/chrome npm run prep`.

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `src/IntroVideo.tsx` | 장면 순서·길이·전환 |
| `src/scenes/*.tsx` | 장면 하나에 파일 하나 |
| `src/theme.tsx` | 앱과 같은 색, 글꼴, 공통 조각(아이콘·화면 틀) |
| `scripts/capture.mjs` | 실제 앱 화면을 찍고 단추 위치를 `public/shots/boxes.json` 에 남김 |
| `scripts/make-bgm.mjs` | 배경음악 만들기 → `public/bgm.wav` |
| `scripts/prep.mjs` | 렌더 전 준비(글꼴·효과음·배경음악·앱 화면) |

## 영상을 올린 뒤

유튜브 주소를 `js/ui/start.js` 의 `INTRO_VIDEO_URL` 에 넣으면 첫 화면에 링크가 나타납니다(비어 있으면 숨김).

## 저작권

- 글꼴: Pretendard, SIL Open Font License 1.1
- 효과음: Remotion 제공(remotion.media)
- 배경음악: 이 저장소에서 직접 만든 곡(`scripts/make-bgm.mjs`)
- 문항·이야기·인물: 짬짬이
