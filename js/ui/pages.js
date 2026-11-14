// 페이지 주소 만들기 — 웹사이트(여러 파일)와 단일 HTML 파일(scripts/build-single.mjs) 양쪽에서 같은 코드가 돈다.
//   웹사이트:   print.html?grade=3&flow=lively · answer.html · credits.html · ./
//   단일 파일:  딸깍보결.html#print?grade=3&flow=lively · #answer · #credits · 딸깍보결.html
// 단일 파일에서는 build-single 이 window.__BOGYUL_SINGLE__ 을 켜 둔다.

export const SINGLE = !!globalThis.__BOGYUL_SINGLE__;

const fileUrl = () => location.href.split('#')[0].split('?')[0];

/** name: 'home' | 'print' | 'answer' | 'credits' */
export function pageUrl(name, query = '') {
  const q = query ? `?${query}` : '';
  if (SINGLE) return name === 'home' ? fileUrl() : `${fileUrl()}#${name}${q}`;
  return name === 'home' ? './' : `${name}.html${q}`;
}

/** 주소의 물음표 뒤 값들(단일 파일은 # 뒤의 물음표) */
export function pageParams() {
  if (SINGLE) return new URLSearchParams(location.hash.split('?')[1] || '');
  return new URLSearchParams(location.search);
}
