// 인물 사진을 세로 540px(화질 70 WebP)로 줄인다.
// 교실 TV(1920×1080)에서 사진은 세로 약 660px로 보이는데, 720px 원본과 540px 를 그 크기로 나란히 놓으면
// 눈으로 차이가 거의 없고 용량은 절반(299장 7.3MB → 3.6MB)이다(2026-11-14 비교, 사용자 결정).
// 처음 받는 양과 단일 HTML 파일이 가벼워진다.
//
// - 세로가 이미 540px 이하인 사진은 건드리지 않는다(다시 압축하면 화질만 떨어진다 — 몇 번 돌려도 같은 결과).
// - scripts/import-jjam.mjs 가 짬짬이에서 사진을 복사할 때 이 함수를 거친다.
// - 따로 돌리면(node scripts/shrink-photos.mjs) assets/people 의 사진을 그 자리에서 줄인다.
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHOTO_MAX_HEIGHT = 540;
export const PHOTO_QUALITY = 70;

/** src 사진을 줄여 dst 에 쓴다. 줄였으면 true, 이미 작아 그대로 복사했으면 false */
export async function shrinkPhoto(src, dst) {
  const input = readFileSync(src);
  const { height } = await sharp(input).metadata();
  if (!height || height <= PHOTO_MAX_HEIGHT) {
    if (src !== dst) writeFileSync(dst, input);
    return false;
  }
  const out = await sharp(input)
    .resize({ height: PHOTO_MAX_HEIGHT, kernel: 'lanczos3' })
    .webp({ quality: PHOTO_QUALITY, effort: 6 })
    .toBuffer();
  writeFileSync(dst, out);
  return true;
}

async function main() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'people');
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
  let before = 0;
  let after = 0;
  let shrunk = 0;
  for (const f of files) {
    const p = join(dir, f);
    before += statSync(p).size;
    if (await shrinkPhoto(p, p)) shrunk += 1;
    after += statSync(p).size;
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(`사진 ${files.length}장 중 ${shrunk}장 줄임: ${mb(before)}MB → ${mb(after)}MB (세로 ${PHOTO_MAX_HEIGHT}px, 화질 ${PHOTO_QUALITY})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
