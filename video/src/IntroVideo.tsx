// 딸깍 보결 1분 소개 영상(1920×1080, 30fps). 장면 사이는 짧게 겹쳐 넘어간다.
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { useEffect, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, continueRender, delayRender, interpolate, staticFile } from "remotion";
import { Activities, ACT_LEN } from "./scenes/Activities";
import { Answer } from "./scenes/Answer";
import { Flow } from "./scenes/Flow";
import { Hook } from "./scenes/Hook";
import { Offline } from "./scenes/Offline";
import { Outro } from "./scenes/Outro";
import { Stars } from "./scenes/Stars";
import { Start } from "./scenes/Start";
import { Title } from "./scenes/Title";
import { C, fontsReady } from "./theme";

const T = 12; // 장면 전환 길이(프레임)
const BGM_VOLUME = 1; // 효과음이 묻히지 않을 만큼

export const SCENES = [
  { name: "Hook", len: 105, el: <Hook /> },
  { name: "Title", len: 120, el: <Title /> },
  { name: "Start", len: 255, el: <Start /> },
  { name: "Flow", len: 180, el: <Flow /> },
  { name: "Activities", len: ACT_LEN * 4, el: <Activities /> },
  { name: "Stars", len: 170, el: <Stars /> },
  { name: "Answer", len: 210, el: <Answer /> },
  { name: "Offline", len: 140, el: <Offline /> },
  { name: "Outro", len: 150, el: <Outro /> },
];

export const INTRO_LEN = SCENES.reduce((a, s) => a + s.len, 0) - T * (SCENES.length - 1);

export const IntroVideo: React.FC = () => {
  const [handle] = useState(() => delayRender("글꼴 읽기"));
  useEffect(() => {
    fontsReady.then(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill style={{ background: C.bg, wordBreak: "keep-all" }}>
      <TransitionSeries>
        {SCENES.flatMap((s, i) => {
          const seq = (
            <TransitionSeries.Sequence key={s.name} name={s.name} durationInFrames={s.len}>
              {s.el}
            </TransitionSeries.Sequence>
          );
          if (i === SCENES.length - 1) return [seq];
          const presentation = i === 0 || i === SCENES.length - 2 ? fade() : slide({ direction: "from-right" });
          return [seq, <TransitionSeries.Transition key={`${s.name}-t`} presentation={presentation} timing={linearTiming({ durationInFrames: T })} />];
        })}
      </TransitionSeries>
      {/* 배경음악(scripts/make-bgm.mjs 로 만든 곡): 처음 0.5초 들어오고 마지막 1.5초 사라진다 */}
      <Audio
        src={staticFile("bgm.wav")}
        volume={(f) =>
          interpolate(f, [0, 15, INTRO_LEN - 45, INTRO_LEN], [0, BGM_VOLUME, BGM_VOLUME, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};
