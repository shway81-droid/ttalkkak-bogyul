// 8. 설치 없이 · 인터넷 없이 · 파일 하나로
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, ICONS, Icon, enter } from "../theme";

const CARDS = [
  { icon: ICONS.click, title: "설치 없이", sub: "크롬·엣지에서 바로" },
  { icon: ICONS.wifiOff, title: "인터넷 없이", sub: "한 번 열면 끊겨도 돼요" },
  { icon: ICONS.file, title: "파일 하나로", sub: "메신저로 받아 더블클릭" },
];

export const Offline: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text, alignItems: "center", paddingTop: 190 }}>
      <div style={{ fontSize: 92, fontWeight: 900, letterSpacing: "-0.02em", ...enter(frame, 0) }}>어느 교실에서든</div>
      <div style={{ display: "flex", gap: 56, marginTop: 110 }}>
        {CARDS.map((c, i) => (
          <div
            key={c.title}
            style={{
              width: 470,
              padding: "64px 30px 56px",
              borderRadius: 32,
              background: C.panel,
              boxShadow: "0 18px 44px rgba(21, 36, 71, 0.1)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 26,
              ...enter(frame, 14 + i * 12),
            }}
          >
            <div style={{ width: 150, height: 150, borderRadius: 99, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon paths={c.icon} size={84} color={C.accentText} stroke={2} />
            </div>
            <div style={{ fontSize: 66, fontWeight: 900 }}>{c.title}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: C.muted }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
