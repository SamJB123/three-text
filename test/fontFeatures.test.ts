import { describe, it, expect } from 'vitest';
import { convertFontFeaturesToString } from '../src/core/shaping/fontFeatures';

describe('fontFeatures utilities', () => {
  describe('convertFontFeaturesToString', () => {
    it('converts boolean true to feature tag', () => {
      expect(convertFontFeaturesToString({ liga: true })).toBe('liga');
    });

    it('converts number 1 to feature tag', () => {
      expect(convertFontFeaturesToString({ liga: 1 })).toBe('liga');
    });

    it('converts false to explicit disable', () => {
      expect(convertFontFeaturesToString({ kern: false })).toBe('kern=0');
    });

    it('converts 0 to explicit disable', () => {
      expect(convertFontFeaturesToString({ kern: 0 })).toBe('kern=0');
    });

    it('converts numbers > 1 to variant values', () => {
      expect(convertFontFeaturesToString({ cv01: 3 })).toBe('cv01=3');
    });

    it('combines multiple features', () => {
      const result = convertFontFeaturesToString({
        liga: true,
        dlig: true,
        kern: false,
        cv01: 3
      });
      expect(result).toBe('liga,dlig,kern=0,cv01=3');
    });

    it('returns undefined for empty object', () => {
      expect(convertFontFeaturesToString({})).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(convertFontFeaturesToString(undefined)).toBeUndefined();
    });

    it('validates 4-character tags', () => {
      const result = convertFontFeaturesToString({
        liga: true,
        toolong: true,
        sh: true
      });
      expect(result).toBe('liga');
    });
  });

});

