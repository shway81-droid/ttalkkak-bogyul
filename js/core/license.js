// 인물 사진 라이선스: 출처 페이지의 라이선스 주소와, 이 사이트에 실어도 되는 라이선스인지.
// 비영리(NC)·변경금지(ND)는 받지 않는다(자료 검증이 막는다).

const CC_RE = /^CC (BY|BY-SA) (\d\.\d)(?: ([a-z]{2}))?$/;

const OTHER = {
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'KOGL Type 1': 'https://www.kogl.or.kr/info/licenseType1.do',
  'Public domain': null,
};

/** 라이선스 이름 → 라이선스 설명 주소(없으면 null) */
export function licenseUrl(name) {
  const m = CC_RE.exec(name || '');
  if (m) return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/${m[3] ? `${m[3]}/` : ''}`;
  return OTHER[name] ?? null;
}

/** 이 사이트에 실어도 되는 라이선스인지 */
export function isFreeLicense(name) {
  return CC_RE.test(name || '') || Object.hasOwn(OTHER, name || '');
}
