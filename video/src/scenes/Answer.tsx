// 7. 실시간 정답 창: 칠판(TV)에는 문제, 선생님 노트북에는 정답
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, ICONS, Icon, Shot, enter } from "../theme";

export const Answer: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text }}>
      <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 92, fontWeight: 900, letterSpacing: "-0.02em", ...enter(frame, 0) }}>
          정답은 <span style={{ color: C.accentText }}>선생님 노트북</span>에만
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: C.muted, marginTop: 18, ...enter(frame, 10) }}>
          [실시간 정답 창 열기]를 누르면 지금 문제의 정답이 바로 떠요
        </div>
      </div>

      {/* 칠판 TV */}
      <div style={{ position: "absolute", left: 110, top: 330, ...enter(frame, 18, 20, 30) }}>
        <Shot src="word.png" width={1060} radius={18} />
        <div style={{ marginTop: 26, textAlign: "center", fontSize: 44, fontWeight: 800 }}>아이들이 보는 칠판 TV</div>
      </div>

      {/* 노트북 정답 창 */}
      <div style={{ position: "absolute", left: 1290, top: 300, ...enter(frame, 34, 20, 30) }}>
        <div
          style={{
            width: 500,
            height: 560,
            borderRadius: 18,
            overflow: "hidden",
            border: `6px solid ${C.accent}`,
            boxShadow: "0 24px 60px rgba(21, 36, 71, 0.2)",
            background: C.bg,
          }}
        >
          <Img src={staticFile("shots/answer-word.png")} style={{ width: 500, display: "block" }} />
        </div>
        <div style={{ marginTop: 26, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, fontSize: 44, fontWeight: 800 }}>
          <Icon paths={ICONS.eye} circles={[[12, 12, 3]]} size={48} color={C.accentText} stroke={2.4} />
          선생님 노트북
        </div>
      </div>

      {/* 실시간 표시 */}
      <div
        style={{
          position: "absolute",
          left: 1170,
          width: 120,
          top: 520,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          fontSize: 30,
          fontWeight: 900,
          color: C.ok,
          opacity: interpolate(frame, [50, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <span style={{ width: 22, height: 22, borderRadius: 99, background: C.ok, opacity: 0.4 + 0.6 * pulse }} />
        실시간
      </div>
    </AbsoluteFill>
  );
};
