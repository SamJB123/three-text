import type { LoadedFont } from '../types';
import { convertFontFeaturesToString } from './fontFeatures';

export class TextMeasurer {
  public static measureTextWidth(
    loadedFont: LoadedFont,
    text: string,
    letterSpacing: number = 0
  ): number {
    const buffer = loadedFont.hb.createBuffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    
    const featuresString = convertFontFeaturesToString(loadedFont.fontFeatures);
    loadedFont.hb.shape(loadedFont.font, buffer, featuresString);

    const glyphInfos = buffer.json(loadedFont.font);
    const letterSpacingInFontUnits = letterSpacing * loadedFont.upem;

    // Calculate total advance width with letter spacing
    let totalWidth = 0;
    glyphInfos.forEach((glyph: any) => {
      totalWidth += glyph.ax;

      if (letterSpacingInFontUnits !== 0) {
        totalWidth += letterSpacingInFontUnits;
      }
    });

    buffer.destroy();
    return totalWidth;
  }
}
