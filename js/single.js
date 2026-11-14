// 단일 HTML 파일(scripts/build-single.mjs)의 시작점. 웹사이트는 쓰지 않는다.
// 파일 하나가 주소의 # 에 따라 네 화면 가운데 하나가 된다:
//   (없음) 수업 · #print?grade=3&flow=lively 진행 대본 · #answer 선생님용 정답 창 · #credits 인물 사진 출처
// 화면마다 뼈대(<template id="tpl-…">)를 body 에 펼치고, 그 화면의 스타일(<style data-mode="…">)만 켠 뒤
// 원래 웹사이트의 시작 모듈을 그대로 불러온다.
const MODES = ['print', 'answer', 'credits'];
const m = location.hash.match(/^#([a-z]+)/);
const mode = m && MODES.includes(m[1]) ? m[1] : 'app';

const tpl = document.getElementById(`tpl-${mode}`);
document.title = tpl.dataset.title || document.title;
for (const s of document.querySelectorAll('style[data-mode]')) {
  s.disabled = !s.dataset.mode.split(' ').includes(mode);
}
document.body.replaceChildren(tpl.content.cloneNode(true));

// 같은 파일 안에서 #print → #answer 처럼 화면만 바꾸면 새로 읽어야 그 화면이 된다
window.addEventListener('hashchange', () => location.reload());

if (mode === 'print') import('./print.js');
else if (mode === 'answer') import('./answer.js');
else if (mode === 'credits') import('./credits.js');
else import('./main.js');
