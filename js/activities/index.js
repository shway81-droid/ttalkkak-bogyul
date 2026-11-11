// 활동 등록표. kind → { mount }.
import { h, fill } from '../ui/dom.js';
import * as greet from './greet.js';
import * as celebrate from './celebrate.js';
import * as word from './word.js';

export const STEP_ICON = {
  greet: '👋',
  word: '🔤',
  gesture: '🙆',
  quizboard: '❓',
  story: '📖',
  draw: '✏️',
  celebrate: '🎉',
};

// 아직 만들지 않은 활동 자리(Task 7~10 에서 진짜로 바꾼다).
const placeholder = {
  mount(el, ctx) {
    fill(el, h('div', { class: 'act-center' }, h('h2', null, ctx.step.title), h('p', null, '준비 중이에요')));
    return { tick() {}, destroy() {} };
  },
};

export const ACTIVITIES = {
  greet,
  word,
  gesture: placeholder,
  quizboard: placeholder,
  story: placeholder,
  draw: placeholder,
  celebrate,
};
