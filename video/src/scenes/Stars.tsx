// 6. 별판: 모둠끼리 비교하지 않고 "우리 반 별"로 함께 — 목표를 채우면 다 같이 축하
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, FONT, ICONS, Icon, enter } from "../theme";

const GOAL = 36;

export const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  const n = Math.round(
    interpolate(frame, [30, 110], [0, GOAL], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.2, 1) }),
  );
  const full = frame >= 110;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text, alignItems: "center" }}>
      {/* 실제 별판(수업 화면 위쪽 띠) */}
      <div
        style={{
          marginTop: 70,
          width: 1700,
          height: (1700 / 1920) * 150,
          overflow: "hidden",
          borderRadius: 18,
          boxShadow: "0 18px 40px rgba(21, 36, 71, 0.14)",
          ...enter(frame, 0),
        }}
      >
        <Img src={staticFile("shots/person.png")} style={{ width: 1700, display: "block" }} />
      </div>

      <div style={{ marginTop: 110, fontSize: 92, fontWeight: 900, letterSpacing: "-0.02em", ...enter(frame, 10) }}>
        모둠끼리 비교하지 않고, <span style={{ color: C.accentText }}>우리 반 별</span>로 함께
      </div>

      <div
        style={{
          marginTop: 70,
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "26px 60px",
          borderRadius: 999,
          border: `6px solid ${C.accent}`,
          background: full ? C.accent : C.panel,
          fontSize: 96,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          scale: interpolate(frame, [110, 118, 128], [1, 1.12, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          ...enter(frame, 22),
        }}
      >
        우리 반 <Icon paths={ICONS.star} size={90} color={full ? C.text : C.star} fill={full ? C.text : C.star} stroke={1.6} />
        {n}
        <span style={{ fontSize: 60, color: full ? C.text : C.muted }}>/ {GOAL}</span>
      </div>
      <div style={{ marginTop: 44, fontSize: 44, fontWeight: 700, color: C.muted, ...enter(frame, 118) }}>
        목표를 채우면 꽃가루와 함께 다 같이 축하해요
      </div>
      <Sequence from={110} layout="none">
        <Audio src={staticFile("sfx/ding.wav")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
