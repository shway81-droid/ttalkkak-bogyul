// 루시드(Lucide) 아이콘 가운데 화면에서 쓰는 것만 골라 js/ui/icon-paths.js 로 담는다.
// 오프라인에서도 떠야 하므로 CDN 을 쓰지 않고 SVG 속 모양만 복사해 둔다.
// 아이콘을 더하거나 바꾸면: NAMES 에 이름을 넣고 `npm run icons` → `npm run stamp`.
// 이름 찾기: https://lucide.dev/icons  (라이선스 ISC — assets/icons/LICENSE.txt)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules', 'lucide-static');

const NAMES = [
  // 순서(활동)
  'hand', 'spell-check', 'person-standing', 'circle-help', 'scan-face', 'book-open', 'party-popper',
  // 첫 화면 흐름
  'zap', 'leaf',
  // 인사 패널
  'users', 'handshake', 'star',
  // 버튼·안내
  'play', 'pause', 'chevron-right', 'chevron-left', 'arrow-right', 'arrow-left', 'skip-forward',
  'circle-check', 'lightbulb', 'dices', 'sprout', 'mic-off', 'messages-square', 'backpack', 'printer',
  // 위쪽 띠
  'timer', 'maximize', 'x', 'volume-2', 'volume-x', 'undo-2',
];

const version = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8')).version;
const out = {};
for (const name of NAMES) {
  const svg = readFileSync(join(SRC, 'icons', `${name}.svg`), 'utf8');
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
  out[name] = inner.replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
}

const body = `// 자동 생성 파일 — 고치지 말고 scripts/build-icons.mjs 를 고친 뒤 \`npm run icons\`.
// Lucide v${version} (ISC License, Copyright (c) Lucide Icons and Contributors) — assets/icons/LICENSE.txt
export const ICON_PATHS = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(join(ROOT, 'js', 'ui', 'icon-paths.js'), body);
mkdirSync(join(ROOT, 'assets', 'icons'), { recursive: true });
copyFileSync(join(SRC, 'LICENSE'), join(ROOT, 'assets', 'icons', 'LICENSE.txt'));
console.log(`아이콘 ${NAMES.length}개 (Lucide v${version}) → js/ui/icon-paths.js`);
