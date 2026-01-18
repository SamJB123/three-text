import { describe, bench } from 'vitest';
import { LineBreak } from '../src/core/layout/LineBreak';

const mockMeasureText = (text: string): number => text.length * 10;

const SHORT_TEXT = 'The quick brown fox jumps over the lazy dog.';

const MEDIUM_TEXT = `Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation.`;

const LONG_TEXT = `Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship.`;

const VERY_LONG_TEXT = LONG_TEXT.repeat(5);

const NARROW_WIDTH = 400;
const MEDIUM_WIDTH = 1000;
const WIDE_WIDTH = 2000;

describe('Short text', () => {
  bench('narrow', () => {
    LineBreak.breakText({
      text: SHORT_TEXT,
      width: NARROW_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });

  bench('wide', () => {
    LineBreak.breakText({
      text: SHORT_TEXT,
      width: WIDE_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });
});

describe('Medium text', () => {
  bench('narrow', () => {
    LineBreak.breakText({
      text: MEDIUM_TEXT,
      width: NARROW_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });

  bench('medium', () => {
    LineBreak.breakText({
      text: MEDIUM_TEXT,
      width: MEDIUM_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });
});

describe('Long text', () => {
  bench('narrow', () => {
    LineBreak.breakText({
      text: LONG_TEXT,
      width: NARROW_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });

  bench('medium', () => {
    LineBreak.breakText({
      text: LONG_TEXT,
      width: MEDIUM_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });

  bench('wide', () => {
    LineBreak.breakText({
      text: LONG_TEXT,
      width: WIDE_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });
});

describe('Very long text', () => {
  bench('medium', () => {
    LineBreak.breakText({
      text: VERY_LONG_TEXT,
      width: MEDIUM_WIDTH,
      measureText: mockMeasureText,
      align: 'justify'
    });
  });
});
