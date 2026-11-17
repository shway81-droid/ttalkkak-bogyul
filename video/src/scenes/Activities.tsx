// 5. 활동 맛보기: 인물 퀴즈 · 몸으로 말해요 · 말놀이 · 이야기 (실제 화면, 천천히 다가가기)
import { AbsoluteFill, interpolate, Series, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, FONT, Shot, enter } from "../theme";

export const ACT_LEN = 105;

const ITEMS = [
  { shot: "person.png", tag: "인물 퀴즈", color: C.orange, text: "사진 속 인물을 모둠이 의논해서 맞혀요" },
  { shot: "gesture.png", tag: "몸으로 말해요", color: C.orange, text: "1분 동안 말없이 몸으로만 설명해요" },
  { shot: "word.png", tag: "말놀이", color: C.orange, text: "학년에 맞는 낱말 문제를 차례로 풀어요" },
  { shot: "story.png", tag: "이야기", color: C.purple, text: "정답 없는 이야기로 생각을 나눠요" },
];

const Card: React.FC<(typeof ITEMS)[number]> = ({ shot, tag, color, text }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text, alignItems: "center" }}>
      <div
        style={{
          marginTop: 56,
          scale: interpolate(frame, [0, ACT_LEN], [1, 1.035]),
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Shot src={shot} width={1440} />
      </div>
      <div style={{ position: "absolute", bottom: 74, display: "flex", alignItems: "center", gap: 28, ...enter(frame, 6, 16, 24) }}>
        <span style={{ background: color, color: "#fff", fontSize: 44, fontWeight: 900, padding: "10px 30px", borderRadius: 999 }}>{tag}</span>
        <span style={{ fontSize: 56, fontWeight: 800 }}>{text}</span>
      </div>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} />
    </AbsoluteFill>
  );
};

export const Activities: React.FC = () => (
  <Series>
    {ITEMS.map((it) => (
      <Series.Sequence key={it.shot} durationInFrames={ACT_LEN}>
        <Card {...it} />
      </Series.Sequence>
    ))}
  </Series>
);
