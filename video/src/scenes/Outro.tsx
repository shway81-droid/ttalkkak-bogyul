// 9. 마무리: 딸깍 보결 — 갑자기 보결, 학년만 누르세요
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, enter } from "../theme";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.text, fontFamily: FONT, color: "#fff", justifyContent: "center", alignItems: "center", gap: 34 }}>
      <div style={{ fontSize: 70, fontWeight: 700, color: "rgba(255,255,255,0.9)", ...enter(frame, 0) }}>갑자기 보결이어도 괜찮아요</div>
      <div
        style={{
          fontSize: 200,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          scale: interpolate(frame, [12, 32], [0.8, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 14 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [12, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        딸깍 <span style={{ color: C.accent }}>보결</span>
      </div>
      <div style={{ fontSize: 60, fontWeight: 800, color: C.accent, ...enter(frame, 30) }}>학년만 누르면 시작돼요</div>
      <div style={{ position: "absolute", bottom: 90, fontSize: 32, fontWeight: 600, color: "rgba(255,255,255,0.6)", ...enter(frame, 40) }}>
        문항·이야기·인물: 짬짬이
      </div>
    </AbsoluteFill>
  );
};
