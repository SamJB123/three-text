import { ExtractedMetrics, FontMetrics, VerticalMetrics } from '../types';
import {
  FONT_SIGNATURE_TRUE_TYPE,
  FONT_SIGNATURE_OPEN_TYPE_CFF,
  FONT_SIGNATURE_TRUE_TYPE_COLLECTION
} from './constants';

export class FontMetadataExtractor {
  public static extractMetadata(fontBuffer: ArrayBuffer): ExtractedMetrics {
    if (!fontBuffer || fontBuffer.byteLength < 12) {
      throw new Error('Invalid font buffer: too small to be a valid font file');
    }

    const view = new DataView(fontBuffer);
    const sfntVersion = view.getUint32(0);

    const validSignatures = [
      FONT_SIGNATURE_TRUE_TYPE,
      FONT_SIGNATURE_OPEN_TYPE_CFF,
      FONT_SIGNATURE_TRUE_TYPE_COLLECTION
    ];

    if (!validSignatures.includes(sfntVersion)) {
      throw new Error(
        `Invalid font format. Expected TrueType or OpenType, got signature: 0x${sfntVersion.toString(
          16
        )}`
      );
    }

    const buffer = new Uint8Array(fontBuffer);
    const numTables = view.getUint16(4); // OpenType header - number of tables is at offset 4

    let isCFF = false;
    let headTableOffset = 0;
    let hheaTableOffset = 0;
    let os2TableOffset = 0;
    let statTableOffset = 0;
    let nameTableOffset = 0;
    let fvarTableOffset = 0;

    for (let i = 0; i < numTables; i++) {
      const tag = new TextDecoder().decode(
        buffer.slice(12 + i * 16, 12 + i * 16 + 4)
      );

      if (tag === 'CFF ') {
        isCFF = true;
      } else if (tag === 'CFF2') {
        isCFF = true;
      }

      if (tag === 'head') {
        headTableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'hhea') {
        hheaTableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'OS/2') {
        os2TableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'fvar') {
        fvarTableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'STAT') {
        statTableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'name') {
        nameTableOffset = view.getUint32(12 + i * 16 + 8);
      }
    }

    const unitsPerEm = headTableOffset
      ? view.getUint16(headTableOffset + 18)
      : 1000;

    let hheaMetrics = null;
    if (hheaTableOffset) {
      hheaMetrics = {
        ascender: view.getInt16(hheaTableOffset + 4),
        descender: view.getInt16(hheaTableOffset + 6),
        lineGap: view.getInt16(hheaTableOffset + 8)
      };
    }

    let os2Metrics = null;
    if (os2TableOffset) {
      os2Metrics = {
        typoAscender: view.getInt16(os2TableOffset + 68),
        typoDescender: view.getInt16(os2TableOffset + 70),
        typoLineGap: view.getInt16(os2TableOffset + 72),
        winAscent: view.getUint16(os2TableOffset + 74),
        winDescent: view.getUint16(os2TableOffset + 76)
      };
    }

    // Extract axis names only for variable fonts (fvar table present) with STAT table
    let axisNames: { [tag: string]: string } | null = null;
    if (fvarTableOffset && statTableOffset && nameTableOffset) {
      axisNames = this.extractAxisNames(view, statTableOffset, nameTableOffset);
    }

    return {
      isCFF,
      unitsPerEm,
      hheaAscender: hheaMetrics?.ascender || null,
      hheaDescender: hheaMetrics?.descender || null,
      hheaLineGap: hheaMetrics?.lineGap || null,
      typoAscender: os2Metrics?.typoAscender || null,
      typoDescender: os2Metrics?.typoDescender || null,
      typoLineGap: os2Metrics?.typoLineGap || null,
      winAscent: os2Metrics?.winAscent || null,
      winDescent: os2Metrics?.winDescent || null,
      axisNames
    };
  }

  public static extractFeatureTags(
    fontBuffer: ArrayBuffer
  ): { tags: string[]; names: { [tag: string]: string } } | undefined {
    const view = new DataView(fontBuffer);
    const numTables = view.getUint16(4);
    const buffer = new Uint8Array(fontBuffer);

    let gsubTableOffset = 0;
    let gposTableOffset = 0;
    let nameTableOffset = 0;

    for (let i = 0; i < numTables; i++) {
      const tag = new TextDecoder().decode(
        buffer.slice(12 + i * 16, 12 + i * 16 + 4)
      );

      if (tag === 'GSUB') {
        gsubTableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'GPOS') {
        gposTableOffset = view.getUint32(12 + i * 16 + 8);
      }

      if (tag === 'name') {
        nameTableOffset = view.getUint32(12 + i * 16 + 8);
      }
    }

    const features = new Set<string>();
    const featureNames: { [tag: string]: string } = {};

    try {
      if (gsubTableOffset) {
        const gsubData = this.extractFeatureDataFromTable(view, gsubTableOffset, nameTableOffset);
        gsubData.features.forEach(f => features.add(f));
        Object.assign(featureNames, gsubData.names);
      }

      if (gposTableOffset) {
        const gposData = this.extractFeatureDataFromTable(view, gposTableOffset, nameTableOffset);
        gposData.features.forEach(f => features.add(f));
        Object.assign(featureNames, gposData.names);
      }
    } catch (e) {
      return undefined;
    }

    const featureArray = Array.from(features).sort();
    if (featureArray.length === 0) return undefined;

    return {
      tags: featureArray,
      names: Object.keys(featureNames).length > 0 ? featureNames : {}
    };
  }

  private static extractFeatureDataFromTable(
    view: DataView,
    tableOffset: number,
    nameTableOffset: number
  ): { features: string[]; names: { [tag: string]: string } } {
    const featureListOffset = view.getUint16(tableOffset + 6);
    const featureListStart = tableOffset + featureListOffset;
    const featureCount = view.getUint16(featureListStart);
    
    const features: string[] = [];
    const names: { [tag: string]: string } = {};

    for (let i = 0; i < featureCount; i++) {
      const recordOffset = featureListStart + 2 + i * 6;
      const tag = String.fromCharCode(
        view.getUint8(recordOffset),
        view.getUint8(recordOffset + 1),
        view.getUint8(recordOffset + 2),
        view.getUint8(recordOffset + 3)
      );
      features.push(tag);

      // Extract feature name for stylistic sets and character variants
      if (/^(ss\d{2}|cv\d{2})$/.test(tag) && nameTableOffset) {
        const featureOffset = view.getUint16(recordOffset + 4);
        const featureTableStart = featureListStart + featureOffset;
        
        // Feature table structure:
        // uint16 FeatureParams offset
        // uint16 LookupCount
        // uint16[LookupCount] LookupListIndex
        
        const featureParamsOffset = view.getUint16(featureTableStart);
        
        // FeatureParams for ss features:
        // uint16 Version (should be 0)
        // uint16 UINameID
        if (featureParamsOffset !== 0) {
          const paramsStart = featureTableStart + featureParamsOffset;
          const version = view.getUint16(paramsStart);
          
          if (version === 0) {
            const nameID = view.getUint16(paramsStart + 2);
            const name = this.getNameFromNameTable(view, nameTableOffset, nameID);
            if (name) {
              names[tag] = name;
            }
          }
        }
      }
    }

    return { features, names };
  }

  private static extractAxisNames(
    view: DataView,
    statOffset: number,
    nameOffset: number
  ): { [tag: string]: string } | null {
    try {
      // STAT table structure
      const majorVersion = view.getUint16(statOffset);

      // We need at least version 1.0
      if (majorVersion < 1) return null;

      const designAxisSize = view.getUint16(statOffset + 4);
      const designAxisCount = view.getUint16(statOffset + 6);
      const designAxisOffset = view.getUint32(statOffset + 8);

      const axisNames: { [tag: string]: string } = {};

      // Read each design axis record (size specified by designAxisSize)
      for (let i = 0; i < designAxisCount; i++) {
        const axisRecordOffset =
          statOffset + designAxisOffset + i * designAxisSize;
        const axisTag = String.fromCharCode(
          view.getUint8(axisRecordOffset),
          view.getUint8(axisRecordOffset + 1),
          view.getUint8(axisRecordOffset + 2),
          view.getUint8(axisRecordOffset + 3)
        );
        const axisNameID = view.getUint16(axisRecordOffset + 4);
        const name = this.getNameFromNameTable(view, nameOffset, axisNameID);
        if (name) {
          axisNames[axisTag] = name;
        }
      }

      return Object.keys(axisNames).length > 0 ? axisNames : null;
    } catch (e) {
      return null;
    }
  }

  private static getNameFromNameTable(
    view: DataView,
    nameOffset: number,
    nameID: number
  ): string | null {
    try {
      // const format = view.getUint16(nameOffset);
      const count = view.getUint16(nameOffset + 2);
      const stringOffset = view.getUint16(nameOffset + 4);

      // Look for the name record with our nameID (preferring English)
      for (let i = 0; i < count; i++) {
        const recordOffset = nameOffset + 6 + i * 12;
        const platformID = view.getUint16(recordOffset);
        const encodingID = view.getUint16(recordOffset + 2);
        const languageID = view.getUint16(recordOffset + 4);
        const recordNameID = view.getUint16(recordOffset + 6);
        const length = view.getUint16(recordOffset + 8);
        const offset = view.getUint16(recordOffset + 10);

        if (recordNameID === nameID) {
          // Prefer Unicode or Windows platform English names
          if (platformID === 0 || (platformID === 3 && languageID === 0x0409)) {
            const stringStart = nameOffset + stringOffset + offset;
            const bytes = new Uint8Array(view.buffer, stringStart, length);

            // Decode based on platform
            if (platformID === 0 || (platformID === 3 && encodingID === 1)) {
              // UTF-16BE
              let str = '';
              for (let j = 0; j < bytes.length; j += 2) {
                str += String.fromCharCode((bytes[j] << 8) | bytes[j + 1]);
              }
              return str;
            } else {
              // ASCII
              return new TextDecoder('ascii').decode(bytes);
            }
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // Priority: typo metrics > hhea metrics > win metrics > fallback, ignore line gap (Google strategy)
  public static getVerticalMetrics(metrics: ExtractedMetrics): VerticalMetrics {
    if (metrics.typoAscender !== null && metrics.typoDescender !== null) {
      return {
        ascender: metrics.typoAscender,
        descender: metrics.typoDescender,
        lineGap: 0
      };
    }

    if (metrics.hheaAscender !== null && metrics.hheaDescender !== null) {
      return {
        ascender: metrics.hheaAscender,
        descender: metrics.hheaDescender,
        lineGap: 0
      };
    }

    if (metrics.winAscent !== null && metrics.winDescent !== null) {
      return {
        ascender: metrics.winAscent,
        descender: -metrics.winDescent, // winDescent is typically positive
        lineGap: 0
      };
    }

    // Last resort - default based on UPM
    return {
      ascender: Math.round(metrics.unitsPerEm * 0.8),
      descender: -Math.round(metrics.unitsPerEm * 0.2),
      lineGap: 0
    };
  }

  public static getFontMetrics(metrics: ExtractedMetrics): FontMetrics {
    const verticalMetrics = FontMetadataExtractor.getVerticalMetrics(metrics);
    return {
      ascender: verticalMetrics.ascender,
      descender: verticalMetrics.descender,
      lineGap: verticalMetrics.lineGap,
      unitsPerEm: metrics.unitsPerEm,
      naturalLineHeight: verticalMetrics.ascender - verticalMetrics.descender
    };
  }
}
