// 3. 첫 화면: ① 학년 ② 흐름 ③ 모둠 수(3~8) ④ 시작 — 실제 화면 위에 강조 상자가 옮겨 다닌다.
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import boxes from "../../public/shots/boxes.json";
import { C, FONT, Shot, enter } from "../theme";

const SHOT_W = 1180;
const K = SHOT_W / 1920;
const SHOT_X = 650;
const SHOT_Y = (1080 - (SHOT_W * 1080) / 1920) / 2;
const PAD = 10;

const STEPS = [
  { at: 20, no: "①", title: "학년을 고르고", sub: "1학년부터 6학년까지", box: boxes.start.grade },
  { at: 80, no: "②", title: "흐름을 정하고", sub: "신나게 열기 · 차분하게 열기", box: boxes.start.flow },
  { at: 140, no: "③", title: "모둠 수를 고르고", sub: "3개부터 8개까지", box: boxes.start.teams },
  { at: 200, no: "④", title: "시작!", sub: "이제 40분이 저절로 흘러가요", box: boxes.start.go },
];

export const Start: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = STEPS.reduce((acc, s, i) => (frame >= s.at ? i : acc), 0);
  const step = STEPS[idx];
  const prev = STEPS[Math.max(0, idx - 1)];
  const t = interpolate(frame, [step.at, step.at + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const lerp = (a: number, b: number) => a + (b - a) * (idx === 0 ? 1 : t);
  const bx = lerp(prev.box.x, step.box.x);
  const by = lerp(prev.box.y, step.box.y);
  const bw = lerp(prev.box.w, step.box.w);
  const bh = lerp(prev.box.h, step.box.h);

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text }}>
      <div style={{ position: "absolute", left: 90, top: 290, width: 530 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: C.accentText, ...enter(frame, 0) }}>준비는 10초</div>
        <div key={idx} style={{ marginTop: 26, ...enter(frame, step.at, 14, 24) }}>
          <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1.12, letterSpacing: "-0.02em" }}>
            <span style={{ color: C.accentText }}>{step.no}</span>
            <br />
            {step.title}
          </div>
          <div style={{ marginTop: 26, fontSize: 44, fontWeight: 700, color: C.muted, lineHeight: 1.3 }}>{step.sub}</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: SHOT_X,
          top: SHOT_Y,
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(21, 36, 71, 0.18)",
          ...enter(frame, 0, 20, 30),
        }}
      >
        <Shot src="start.png" width={SHOT_W} />
        <div
          style={{
            position: "absolute",
            left: bx * K - PAD,
            top: by * K - PAD,
            width: bw * K + PAD * 2,
            height: bh * K + PAD * 2,
            border: `6px solid ${C.accent}`,
            borderRadius: 20,
            boxShadow: `0 0 0 9999px rgba(21, 36, 71, ${interpolate(frame, [14, 24], [0, 0.28], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
            opacity: interpolate(frame, [14, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        />
      </div>

      {STEPS.map((s) => (
        <Sequence key={s.at} from={s.at} durationInFrames={20} layout="none">
          <Audio src={staticFile("sfx/mouse-click.wav")} volume={0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
