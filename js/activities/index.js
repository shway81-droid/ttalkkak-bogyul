// 활동 등록표. kind → { mount }.
import * as greet from './greet.js';
import * as word from './word.js';
import * as gesture from './gesture.js';
import * as quizboard from './quizboard.js';
import * as story from './story.js';
import * as celebrate from './celebrate.js';

export const STEP_ICON = {
  greet: '👋',
  word: '🔤',
  gesture: '🙆',
  quizboard: '❓',
  person: '🧑',
  story: '📖',
  celebrate: '🎉',
};

// 인물 퀴즈는 말놀이와 진행이 같아 word.js 가 함께 맡는다(step.kind 로 사진 화면을 가른다).
export const ACTIVITIES = { greet, word, gesture, quizboard, person: word, story, celebrate };
