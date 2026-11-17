// 2. 제목: 딸깍 보결 — 학년만 누르면 40분 모둠 수업이 시작돼요
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, enter } from "../theme";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text, justifyContent: "center", alignItems: "center", gap: 40 }}>
      <div
        style={{
          fontSize: 220,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          scale: interpolate(frame, [0, 22], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        딸깍 <span style={{ color: C.accentText }}>보결</span>
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, color: C.muted, ...enter(frame, 20) }}>
        학년만 누르면 <b style={{ color: C.text, fontWeight: 900 }}>40분 모둠 수업</b>이 시작돼요
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 38,
          fontWeight: 700,
          color: C.accentText,
          background: C.accentSoft,
          padding: "14px 34px",
          borderRadius: 999,
          ...enter(frame, 42),
        }}
      >
        갑자기 보결 들어간 초등 선생님을 위해
      </div>
    </AbsoluteFill>
  );
};
