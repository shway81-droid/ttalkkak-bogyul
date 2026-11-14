// 인물 사진 출처 페이지(credits.html): 사진마다 저작자·라이선스·원본 주소.
import { h, fill } from './ui/dom.js';
import { licenseUrl } from './core/license.js';
import { icon } from './ui/icons.js';
import { loadData } from './core/data.js';
import { pageUrl } from './ui/pages.js';

const back = document.querySelector('.back');
if (back) {
  back.href = pageUrl('home');
  back.prepend(icon('arrow-left'), ' ');
}

const link = (href, text, attrs = {}) => h('a', { href, target: '_blank', rel: 'noopener', ...attrs }, text);

async function main() {
  const count = document.getElementById('count');
  try {
    const { people } = await loadData();
    fill(document.getElementById('rows'),
      people.map((p, i) => {
        const lic = licenseUrl(p.photo.license);
        return h('tr', { 'data-credit-row': '' },
          h('td', { class: 'no' }, String(i + 1)),
          h('td', null, p.answer),
          h('td', null, p.photo.author),
          h('td', null, lic ? link(lic, p.photo.license) : p.photo.license),
          h('td', null, link(p.photo.source, '보기', { 'data-source': '' })));
      }));
    count.textContent = `사진 ${people.length}장`;
  } catch (err) {
    count.textContent = '목록을 읽지 못했어요. 새로고침해 주세요.';
    throw err;
  } finally {
    document.body.dataset.creditsReady = '1';
  }
}

main();
