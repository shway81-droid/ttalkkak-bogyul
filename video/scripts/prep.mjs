// 렌더 전에 한 번: 글꼴 복사 · 효과음 받기 · 앱 화면 다시 찍기 (모두 public/ 아래, 저장소에는 넣지 않음)
//   cd video && npm run prep
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => join(HERE, 'public', ...p);

// 1) 글꼴: Pretendard 전체(SIL OFL 1.1) — 영상 글자는 앱 서브셋에 없는 글자도 쓴다
mkdirSync(pub('fonts'), { recursive: true });
for (const w of ['Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black']) {
  copyFileSync(join(HERE, 'node_modules/pretendard/dist/web/static/woff2', `Pretendard-${w}.woff2`), pub('fonts', `Pretendard-${w}.woff2`));
}

// 2) 효과음: Remotion 이 제공하는 짧은 소리
mkdirSync(pub('sfx'), { recursive: true });
for (const name of ['whoosh', 'mouse-click', 'ding']) {
  const file = pub('sfx', `${name}.wav`);
  if (existsSync(file)) continue;
  const res = await fetch(`https://remotion.media/${name}.wav`);
  if (!res.ok) throw new Error(`효과음 ${name} 을 받지 못했어요 (${res.status})`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// 3) 배경음악: 코드로 직접 만든 곡(저작권 걱정 없음)
execFileSync(process.execPath, [join(HERE, 'scripts', 'make-bgm.mjs')], { stdio: 'inherit' });

// 4) 앱 화면: 저장소 맨 위의 Playwright 로 실제 화면을 찍는다
execFileSync(process.execPath, [join(HERE, 'scripts', 'capture.mjs')], { stdio: 'inherit', cwd: join(HERE, '..') });
console.log('준비 끝: npm run render');
