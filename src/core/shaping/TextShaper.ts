import { Vec3 } from '../../utils/vectors';
import {
  LoadedFont,
  GlyphGeometryInfo,
  LineInfo,
  TextDirection,
  HarfBuzzGlyph,
  GlyphCluster,
  ColorOptions,
  FontVariationByRange
} from '../types';
import { GlyphGeometryBuilder } from '../cache/GlyphGeometryBuilder';
import { TextMeasurer } from './TextMeasurer';
import { perfLogger } from '../../utils/PerformanceLogger';
import { SPACE_STRETCH_RATIO, SPACE_SHRINK_RATIO } from '../layout/constants';
import { convertFontFeaturesToString } from './fontFeatures';
import { LineBreak } from '../layout/LineBreak';

export interface ShapedResult {
  geometry: any;
  glyphInfos: GlyphGeometryInfo[];
  planeBounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  cacheStats?: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// Font pool for multi-variation support
export interface FontPool {
  defaultFont: LoadedFont;
  variationFonts: Map<string, LoadedFont>;
}

// Maps character index to variation key (empty string = default)
export type VariationIndexMap = Map<number, string>;

// Shapes text with glyph caching
export class TextShaper {
  private loadedFont: LoadedFont;
  private fontPool?: FontPool;
  private geometryBuilder: GlyphGeometryBuilder;
  // Key includes letterSpacing + font variation signature to prevent cross-contamination
  private cachedSpaceWidth: Map<string, number> = new Map();

  constructor(loadedFont: LoadedFont, geometryBuilder: GlyphGeometryBuilder) {
    this.loadedFont = loadedFont;
    this.geometryBuilder = geometryBuilder;
  }

  public setFontPool(fontPool: FontPool): void {
    this.fontPool = fontPool;
    this.loadedFont = fontPool.defaultFont;
  }

  public shapeLines(
    lineInfos: LineInfo[],
    scaledLineHeight: number,
    letterSpacing: number,
    align: string,
    direction: TextDirection,
    color?: [number, number, number] | ColorOptions,
    originalText?: string,
    variationIndexMap?: VariationIndexMap
  ): GlyphCluster[][] {
    perfLogger.start('TextShaper.shapeLines', {
      lineCount: lineInfos.length
    });
    try {
      const clustersByLine: GlyphCluster[][] = [];

      lineInfos.forEach((lineInfo, lineIndex) => {
        const clusters = this.shapeLineIntoClusters(
          lineInfo,
          lineIndex,
          scaledLineHeight,
          letterSpacing,
          align,
          direction,
          variationIndexMap
        );
        clustersByLine.push(clusters);
      });
      return clustersByLine;
    } finally {
      perfLogger.end('TextShaper.shapeLines');
    }
  }

  private shapeLineIntoClusters(
    lineInfo: LineInfo,
    lineIndex: number,
    scaledLineHeight: number,
    letterSpacing: number,
    align: string,
    direction: TextDirection,
    variationIndexMap?: VariationIndexMap
  ): GlyphCluster[] {
    // If we have variation ranges, use segmented shaping
    console.log('[three-text:Shaper] shapeLineIntoClusters check:', {
      hasVariationIndexMap: !!variationIndexMap,
      hasFontPool: !!this.fontPool,
      variationIndexMapSize: variationIndexMap?.size ?? 0
    });
    if (variationIndexMap && this.fontPool && variationIndexMap.size > 0) {
      console.log('[three-text:Shaper] USING shapeLineWithVariations');
      return this.shapeLineWithVariations(
        lineInfo,
        lineIndex,
        scaledLineHeight,
        letterSpacing,
        align,
        direction,
        variationIndexMap
      );
    }

    // Standard single-font path
    const buffer = this.loadedFont.hb.createBuffer();
    if (direction === 'rtl') {
      buffer.setDirection('rtl');
    }

    buffer.addText(lineInfo.text);
    buffer.guessSegmentProperties();

    const featuresString = convertFontFeaturesToString(
      this.loadedFont.fontFeatures
    );
    this.loadedFont.hb.shape(this.loadedFont.font, buffer, featuresString);

    const glyphInfos: HarfBuzzGlyph[] = buffer.json(this.loadedFont.font);
    buffer.destroy();

    // Set font reference on each glyph for geometry building
    for (const glyph of glyphInfos) {
      glyph.font = this.loadedFont;
    }

    const clusters: GlyphCluster[] = [];
    let currentClusterGlyphs: HarfBuzzGlyph[] = [];
    let clusterTextChars: string[] = [];
    let clusterStartX = 0;
    let clusterStartY = 0;

    let cursorX = lineInfo.xOffset;
    let cursorY = -lineIndex * scaledLineHeight;
    const cursorZ = 0;
    // Apply letter spacing after each glyph to match width measurements used during line breaking
    const letterSpacingFU = letterSpacing * this.loadedFont.upem;

    const spaceAdjustment = this.calculateSpaceAdjustment(
      lineInfo,
      align,
      letterSpacing
    );

    const cjkAdjustment = this.calculateCJKAdjustment(lineInfo, align);
    const lineText = lineInfo.text;
    const lineTextLength = lineText.length;
    const glyphCount = glyphInfos.length;
    let nextCharIsCJK: boolean | undefined;

    for (let i = 0; i < glyphCount; i++) {
      const glyph = glyphInfos[i];
      const charIndex = glyph.cl;
      const char = lineText[charIndex];
      const charCode = char.charCodeAt(0);
      const isWhitespace =
        charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13;

      // Inserted hyphens inherit the color of the last character in the word
      if (
        lineInfo.endedWithHyphen &&
        charIndex === lineTextLength - 1 &&
        char === '-'
      ) {
        glyph.absoluteTextIndex = lineInfo.originalEnd;
      } else {
        glyph.absoluteTextIndex = lineInfo.originalStart + charIndex;
      }

      glyph.lineIndex = lineIndex;

      // Cluster boundaries are based on whitespace only.
      // Coloring is applied later via vertex colors and must never affect shaping/kerning.
      if (isWhitespace) {
        if (currentClusterGlyphs.length > 0) {
          clusters.push({
            text: clusterTextChars.join(''),
            glyphs: currentClusterGlyphs,
            position: new Vec3(clusterStartX, clusterStartY, cursorZ)
          });
          currentClusterGlyphs = [];
          clusterTextChars = [];
        }
      }

      const absoluteGlyphX = cursorX + glyph.dx;
      const absoluteGlyphY = cursorY + glyph.dy;

      if (!isWhitespace) {
        if (currentClusterGlyphs.length === 0) {
          clusterStartX = absoluteGlyphX;
          clusterStartY = absoluteGlyphY;
        }
        glyph.x = absoluteGlyphX - clusterStartX;
        glyph.y = absoluteGlyphY - clusterStartY;
        currentClusterGlyphs.push(glyph);
        clusterTextChars.push(char);
      }

      cursorX += glyph.ax;
      cursorY += glyph.ay;

      if (letterSpacingFU !== 0 && i < glyphCount - 1) {
        cursorX += letterSpacingFU;
      }

      if (isWhitespace) {
        cursorX += spaceAdjustment;
      }

      // CJK glue adjustment (must match exactly where LineBreak adds glue)
      if (cjkAdjustment !== 0 && i < glyphCount - 1 && !isWhitespace) {
        const nextGlyph = glyphInfos[i + 1];
        const nextChar = lineText[nextGlyph.cl];
        const isCJK =
          nextCharIsCJK !== undefined ? nextCharIsCJK : LineBreak.isCJK(char);
        nextCharIsCJK = nextChar ? LineBreak.isCJK(nextChar) : false;

        if (isCJK && nextCharIsCJK) {
          let shouldApply = true;

          if (LineBreak.isCJClosingPunctuation(nextChar)) {
            shouldApply = false;
          }

          if (LineBreak.isCJOpeningPunctuation(char)) {
            shouldApply = false;
          }

          if (
            LineBreak.isCJPunctuation(char) &&
            LineBreak.isCJPunctuation(nextChar)
          ) {
            shouldApply = false;
          }

          if (shouldApply) {
            cursorX += cjkAdjustment;
          }
        }
      } else {
        nextCharIsCJK = undefined;
      }
    }

    if (currentClusterGlyphs.length > 0) {
      clusters.push({
        text: clusterTextChars.join(''),
        glyphs: currentClusterGlyphs,
        position: new Vec3(clusterStartX, clusterStartY, cursorZ)
      });
    }

    return clusters;
  }

  /**
   * Shape a line with multiple font variations.
   * Segments the line by variation boundaries and shapes each with its font.
   */
  private shapeLineWithVariations(
    lineInfo: LineInfo,
    lineIndex: number,
    scaledLineHeight: number,
    letterSpacing: number,
    align: string,
    direction: TextDirection,
    variationIndexMap: VariationIndexMap
  ): GlyphCluster[] {
    const lineText = lineInfo.text;
    const lineStart = lineInfo.originalStart;

    // Build variation segments for this line
    const segments: Array<{
      start: number;  // index in line text
      end: number;
      variationKey: string;
      font: LoadedFont;
    }> = [];

    let currentKey = '';
    let segmentStart = 0;

    for (let i = 0; i < lineText.length; i++) {
      const absoluteIndex = lineStart + i;
      const key = variationIndexMap.get(absoluteIndex) || '';

      if (i === 0) {
        currentKey = key;
        segmentStart = 0;
      } else if (key !== currentKey) {
        // End current segment, start new one
        const varFont = currentKey ? this.fontPool!.variationFonts.get(currentKey) : undefined;
        if (currentKey && !varFont) {
          console.warn(`[three-text] Variation font not found for key "${currentKey}", falling back to default`);
        }
        segments.push({
          start: segmentStart,
          end: i,
          variationKey: currentKey,
          font: varFont || this.fontPool!.defaultFont
        });
        currentKey = key;
        segmentStart = i;
      }
    }

    // Push final segment
    if (lineText.length > 0) {
      const varFont = currentKey ? this.fontPool!.variationFonts.get(currentKey) : undefined;
      if (currentKey && !varFont) {
        console.warn(`[three-text] Variation font not found for key "${currentKey}", falling back to default`);
      }
      segments.push({
        start: segmentStart,
        end: lineText.length,
        variationKey: currentKey,
        font: varFont || this.fontPool!.defaultFont
      });
    }

    console.log('[three-text:Shaper] segments:', segments.map(s => ({
      start: s.start,
      end: s.end,
      variationKey: s.variationKey,
      fontPtr: s.font.font.ptr,
      fontVariations: s.font.fontVariations
    })));

    // Shape each segment and accumulate glyphs
    const allGlyphs: HarfBuzzGlyph[] = [];
    let cursorX = lineInfo.xOffset;
    const letterSpacingFU = letterSpacing * this.loadedFont.upem;

    for (const segment of segments) {
      const segmentText = lineText.slice(segment.start, segment.end);
      if (segmentText.length === 0) continue;

      const font = segment.font;
      const buffer = font.hb.createBuffer();
      if (direction === 'rtl') {
        buffer.setDirection('rtl');
      }

      buffer.addText(segmentText);
      buffer.guessSegmentProperties();

      const featuresString = convertFontFeaturesToString(font.fontFeatures);
      font.hb.shape(font.font, buffer, featuresString);

      const segmentGlyphs: HarfBuzzGlyph[] = buffer.json(font.font);
      buffer.destroy();

      // Adjust glyph positions and cluster indices
      for (let i = 0; i < segmentGlyphs.length; i++) {
        const glyph = segmentGlyphs[i];
        // cl is relative to segment, convert to line-relative
        glyph.cl = glyph.cl + segment.start;
        glyph.lineIndex = lineIndex;
        glyph.font = font; // Track which font shaped this glyph
        (glyph as any).variationKey = segment.variationKey; // Store variation key for geometry lookup

        // Calculate absolute text index for coloring
        const charIndex = glyph.cl;
        if (
          lineInfo.endedWithHyphen &&
          charIndex === lineText.length - 1 &&
          lineText[charIndex] === '-'
        ) {
          glyph.absoluteTextIndex = lineInfo.originalEnd;
        } else {
          glyph.absoluteTextIndex = lineInfo.originalStart + charIndex;
        }

        // Offset glyph position by accumulated cursor
        glyph.dx = (glyph.dx || 0);
        glyph.dy = (glyph.dy || 0);

        allGlyphs.push(glyph);

        // Advance cursor
        cursorX += glyph.ax;
        if (letterSpacingFU !== 0 && i < segmentGlyphs.length - 1) {
          cursorX += letterSpacingFU;
        }
      }
    }

    // Now build clusters from allGlyphs using the standard logic
    return this.buildClustersFromGlyphs(
      allGlyphs,
      lineInfo,
      lineIndex,
      scaledLineHeight,
      letterSpacing,
      align
    );
  }

  /**
   * Build word clusters from shaped glyphs (extracted from shapeLineIntoClusters)
   */
  private buildClustersFromGlyphs(
    glyphInfos: HarfBuzzGlyph[],
    lineInfo: LineInfo,
    lineIndex: number,
    scaledLineHeight: number,
    letterSpacing: number,
    align: string
  ): GlyphCluster[] {
    const clusters: GlyphCluster[] = [];
    let currentClusterGlyphs: HarfBuzzGlyph[] = [];
    let clusterTextChars: string[] = [];
    let clusterStartX = 0;
    let clusterStartY = 0;

    let cursorX = lineInfo.xOffset;
    let cursorY = -lineIndex * scaledLineHeight;
    const cursorZ = 0;
    const letterSpacingFU = letterSpacing * this.loadedFont.upem;

    const spaceAdjustment = this.calculateSpaceAdjustment(
      lineInfo,
      align,
      letterSpacing
    );

    const cjkAdjustment = this.calculateCJKAdjustment(lineInfo, align);
    const lineText = lineInfo.text;
    const lineTextLength = lineText.length;
    const glyphCount = glyphInfos.length;
    let nextCharIsCJK: boolean | undefined;

    for (let i = 0; i < glyphCount; i++) {
      const glyph = glyphInfos[i];
      const charIndex = glyph.cl;
      const char = lineText[charIndex];
      const charCode = char?.charCodeAt(0) || 0;
      const isWhitespace =
        charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13;

      if (isWhitespace) {
        if (currentClusterGlyphs.length > 0) {
          clusters.push({
            text: clusterTextChars.join(''),
            glyphs: currentClusterGlyphs,
            position: new Vec3(clusterStartX, clusterStartY, cursorZ)
          });
          currentClusterGlyphs = [];
          clusterTextChars = [];
        }
      }

      const absoluteGlyphX = cursorX + glyph.dx;
      const absoluteGlyphY = cursorY + glyph.dy;

      if (!isWhitespace) {
        if (currentClusterGlyphs.length === 0) {
          clusterStartX = absoluteGlyphX;
          clusterStartY = absoluteGlyphY;
        }
        glyph.x = absoluteGlyphX - clusterStartX;
        glyph.y = absoluteGlyphY - clusterStartY;
        currentClusterGlyphs.push(glyph);
        clusterTextChars.push(char);
      }

      cursorX += glyph.ax;
      cursorY += glyph.ay;

      if (letterSpacingFU !== 0 && i < glyphCount - 1) {
        cursorX += letterSpacingFU;
      }

      if (isWhitespace) {
        cursorX += spaceAdjustment;
      }

      // CJK glue adjustment
      if (cjkAdjustment !== 0 && i < glyphCount - 1 && !isWhitespace) {
        const nextGlyph = glyphInfos[i + 1];
        const nextChar = lineText[nextGlyph.cl];
        const isCJK =
          nextCharIsCJK !== undefined ? nextCharIsCJK : LineBreak.isCJK(char);
        nextCharIsCJK = nextChar ? LineBreak.isCJK(nextChar) : false;

        if (isCJK && nextCharIsCJK) {
          let shouldApply = true;
          if (LineBreak.isCJClosingPunctuation(nextChar)) shouldApply = false;
          if (LineBreak.isCJOpeningPunctuation(char)) shouldApply = false;
          if (LineBreak.isCJPunctuation(char) && LineBreak.isCJPunctuation(nextChar)) {
            shouldApply = false;
          }
          if (shouldApply) cursorX += cjkAdjustment;
        }
      } else {
        nextCharIsCJK = undefined;
      }
    }

    if (currentClusterGlyphs.length > 0) {
      clusters.push({
        text: clusterTextChars.join(''),
        glyphs: currentClusterGlyphs,
        position: new Vec3(clusterStartX, clusterStartY, cursorZ)
      });
    }

    return clusters;
  }

  private calculateSpaceAdjustment(
    lineInfo: LineInfo,
    align: string,
    letterSpacing: number
  ): number {
    let spaceAdjustment = 0;

    if (
      lineInfo.adjustmentRatio !== undefined &&
      align === 'justify' &&
      !lineInfo.isLastLine
    ) {
      // Include font variation in cache key to prevent cross-contamination
      const varSig = this.loadedFont.fontVariations
        ? Object.keys(this.loadedFont.fontVariations).sort().map(k => `${k}:${this.loadedFont.fontVariations![k]}`).join(',')
        : 'default';
      const cacheKey = `${letterSpacing}_${varSig}`;
      let naturalSpaceWidth = this.cachedSpaceWidth.get(cacheKey);
      if (naturalSpaceWidth === undefined) {
        naturalSpaceWidth = TextMeasurer.measureTextWidth(
          this.loadedFont,
          ' ',
          letterSpacing
        );
        this.cachedSpaceWidth.set(cacheKey, naturalSpaceWidth);
      }

      const width = naturalSpaceWidth!;
      const stretchFactor = SPACE_STRETCH_RATIO;
      const shrinkFactor = SPACE_SHRINK_RATIO;

      if (lineInfo.adjustmentRatio > 0) {
        spaceAdjustment = lineInfo.adjustmentRatio * width * stretchFactor;
      } else if (lineInfo.adjustmentRatio < 0) {
        spaceAdjustment = lineInfo.adjustmentRatio * width * shrinkFactor;
      }
    }

    return spaceAdjustment;
  }

  private calculateCJKAdjustment(lineInfo: LineInfo, align: string): number {
    if (
      lineInfo.adjustmentRatio === undefined ||
      align !== 'justify' ||
      lineInfo.isLastLine
    ) {
      return 0;
    }

    const baseCharWidth = this.loadedFont.upem;
    const glueStretch = baseCharWidth * 0.04;
    const glueShrink = baseCharWidth * 0.04;

    if (lineInfo.adjustmentRatio > 0) {
      return lineInfo.adjustmentRatio * glueStretch;
    } else if (lineInfo.adjustmentRatio < 0) {
      return lineInfo.adjustmentRatio * glueShrink;
    }

    return 0;
  }

  public clearCache(): void {
    this.geometryBuilder.clearCache();
  }

  public getCacheStats() {
    return this.geometryBuilder.getCacheStats();
  }
}
