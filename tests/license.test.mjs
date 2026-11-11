import { test } from 'node:test';
import assert from 'node:assert/strict';
import { licenseUrl, isFreeLicense } from '../js/core/license.js';
import { validateData, readDataDir } from '../scripts/validate-data.mjs';

test('licenseUrl: CC 라이선스는 해당 판의 주소, 퍼블릭 도메인은 없음', () => {
  assert.equal(licenseUrl('CC BY 3.0'), 'https://creativecommons.org/licenses/by/3.0/');
  assert.equal(licenseUrl('CC BY-SA 4.0'), 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(licenseUrl('CC BY 2.0 kr'), 'https://creativecommons.org/licenses/by/2.0/kr/');
  assert.equal(licenseUrl('CC0'), 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(licenseUrl('KOGL Type 1'), 'https://www.kogl.or.kr/info/licenseType1.do');
  assert.equal(licenseUrl('Public domain'), null);
});

test('isFreeLicense: 비영리(NC)·변경금지(ND)·모르는 라이선스는 거른다', () => {
  for (const ok of ['CC BY 2.0', 'CC BY 3.0 br', 'CC BY-SA 3.0', 'CC0', 'Public domain', 'KOGL Type 1']) assert.ok(isFreeLicense(ok), ok);
  for (const bad of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'All rights reserved', '', undefined]) assert.ok(!isFreeLicense(bad), String(bad));
});

test('validateData: 쓸 수 없는 라이선스의 사진은 그 인물 id 가 든 오류', () => {
  const data = structuredClone(readDataDir());
  data.people[5].photo.license = 'CC BY-NC 4.0';
  const errs = validateData(data);
  assert.ok(errs.some((e) => e.includes(data.people[5].id) && e.includes('라이선스')), errs.join('\n'));
});
