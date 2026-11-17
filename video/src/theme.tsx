// 딸깍 보결 소개 영상의 색·글꼴·공통 조각. 색은 앱(css/base.css)과 같게 맞춘다.
import { loadFont } from "@remotion/fonts";
import React from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";

export const C = {
  bg: "#f4f6fa",
  panel: "#ffffff",
  panel2: "#e9edf5",
  line: "#dce1ec",
  text: "#152447",
  muted: "#55607a",
  accent: "#ffb703",
  accentSoft: "#fff4d6",
  accentText: "#a86a00",
  star: "#f5a800",
  ok: "#12a57c",
  purple: "#7a5fd0",
  orange: "#f08a40",
  gray: "#aab3c2",
};

export const FONT = "Pretendard";

const WEIGHTS: [string, string][] = [
  ["500", "Medium"],
  ["600", "SemiBold"],
  ["700", "Bold"],
  ["800", "ExtraBold"],
  ["900", "Black"],
];

export const fontsReady = Promise.all(
  WEIGHTS.map(([weight, name]) =>
    loadFont({ family: FONT, url: staticFile(`fonts/Pretendard-${name}.woff2`), weight }),
  ),
);

export const FPS = 30;

/** 0→1 로 부드럽게(앞부분이 빠르고 끝이 느림) */
export const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** 들어오기: 아래에서 살짝 올라오며 나타남 */
export function enter(frame: number, at: number, dur = 18, dist = 40) {
  const t = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return { opacity: t, translate: `0px ${(1 - t) * dist}px` };
}

/** 루시드 아이콘(선 그림). d 는 path 들의 d 값 */
export const Icon: React.FC<{ paths: string[]; size: number; color: string; stroke?: number; fill?: string; circles?: [number, number, number][] }> = ({
  paths,
  size,
  color,
  stroke = 2,
  fill = "none",
  circles = [],
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
    {circles.map(([cx, cy, r]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
    ))}
  </svg>
);

export const ICONS = {
  star: [
    "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
  ],
  click: [
    "M14 4.1 12 6",
    "m5.1 8-2.9-.8",
    "m6 12-1.9 2",
    "M7.2 2.2 8 5.1",
    "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z",
  ],
  wifiOff: [
    "M12 20h.01",
    "M8.5 16.429a5 5 0 0 1 7 0",
    "M5 12.859a10 10 0 0 1 5.17-2.69",
    "M19 12.859a10 10 0 0 0-2.007-1.523",
    "M2 8.82a15 15 0 0 1 4.177-2.643",
    "M22 8.82a15 15 0 0 0-11.288-3.764",
    "m2 2 20 20",
  ],
  file: [
    "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
    "M14 2v5a1 1 0 0 0 1 1h5",
    "m9 15 2 2 4-4",
  ],
  eye: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"],
};

/** 앱 화면 캡처를 둥근 테두리 안에 */
export const Shot: React.FC<{ src: string; width: number; style?: React.CSSProperties; radius?: number }> = ({ src, width, style, radius = 22 }) => (
  <div
    style={{
      width,
      height: (width * 1080) / 1920,
      borderRadius: radius,
      overflow: "hidden",
      boxShadow: "0 24px 60px rgba(21, 36, 71, 0.18), 0 0 0 2px rgba(21, 36, 71, 0.06)",
      background: C.panel,
      ...style,
    }}
  >
    <Img src={staticFile(`shots/${src}`)} style={{ width: "100%", height: "100%", display: "block" }} />
  </div>
);
