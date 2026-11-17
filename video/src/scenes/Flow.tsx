// 4. 40분 흐름: 인사 → 인물 퀴즈 → 모둠 놀이 → 말놀이 → 이야기 → 축하 (js/core/flows.js 의 '신나게 열기')
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, enter } from "../theme";

const SLOTS: [string, number, string][] = [
  ["인사", 3, C.gray],
  ["인물 퀴즈", 8, C.orange],
  ["모둠 놀이", 10, C.orange],
  ["말놀이", 10, C.orange],
  ["이야기", 7, C.purple],
  ["축하", 2, C.gray],
];
const BAR_W = 1600;
const GAP = 12;
const TOTAL = 40;

export const Flow: React.FC = () => {
  const frame = useCurrentFrame();
  const unit = (BAR_W - GAP * (SLOTS.length - 1)) / TOTAL;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text, alignItems: "center", paddingTop: 170 }}>
      <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: "-0.02em", ...enter(frame, 0) }}>40분이 저절로 흘러가요</div>
      <div style={{ fontSize: 46, fontWeight: 700, color: C.muted, marginTop: 24, ...enter(frame, 10) }}>
        순서마다 타이머가 돌고, 선생님은 <b style={{ color: C.text }}>[다음 순서]</b>만 누르면 돼요
      </div>
      <div style={{ display: "flex", gap: GAP, marginTop: 120, width: BAR_W }}>
        {SLOTS.map(([name, min, color], i) => {
          const at = 24 + i * 12;
          const grow = interpolate(frame, [at, at + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={name} style={{ width: unit * min, display: "flex", flexDirection: "column", gap: 22 }}>
              <div
                style={{
                  height: 90,
                  borderRadius: 18,
                  background: color,
                  scale: `${grow} 1`,
                  transformOrigin: "left center",
                }}
              />
              <div style={{ textAlign: "center", opacity: grow, whiteSpace: "nowrap" }}>
                <div style={{ fontSize: min >= 7 ? 46 : 34, fontWeight: 900 }}>{name}</div>
                <div style={{ fontSize: 34, fontWeight: 700, color: C.muted, marginTop: 6 }}>{min}분</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, color: C.accentText, marginTop: 90, ...enter(frame, 110) }}>
        차분하게 열고 싶으면 이야기부터 시작할 수도 있어요
      </div>
    </AbsoluteFill>
  );
};
