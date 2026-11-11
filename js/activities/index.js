// 활동 등록표. kind → { mount }.
import * as greet from './greet.js';
import * as word from './word.js';
import * as gesture from './gesture.js';
import * as quizboard from './quizboard.js';
import * as story from './story.js';
import * as draw from './draw.js';
import * as celebrate from './celebrate.js';

export const STEP_ICON = {
  greet: '👋',
  word: '🔤',
  gesture: '🙆',
  quizboard: '❓',
  story: '📖',
  draw: '✏️',
  celebrate: '🎉',
};

export const ACTIVITIES = { greet, word, gesture, quizboard, story, draw, celebrate };
