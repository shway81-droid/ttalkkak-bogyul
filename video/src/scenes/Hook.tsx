// 1. 고민: "갑자기 보결 수업이 생겼어요 / 40분 동안 뭘 하지?"
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, enter } from "../theme";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ background: C.text, fontFamily: FONT, color: "#fff", justifyContent: "center", alignItems: "center", gap: 36 }}
    >
      <div style={{ fontSize: 76, fontWeight: 700, color: "rgba(255,255,255,0.92)", ...enter(frame, 4) }}>갑자기 보결 수업이 생겼어요</div>
      <div
        style={{
          fontSize: 132,
          fontWeight: 900,
          color: C.accent,
          letterSpacing: "-0.02em",
          ...enter(frame, 34, 20, 60),
          scale: interpolate(frame, [34, 54], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        40분 동안 뭘 하지?
      </div>
    </AbsoluteFill>
  );
};
