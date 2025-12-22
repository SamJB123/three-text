// Export core Text class (framework-agnostic)
export { Text } from './core/Text';
export { DEFAULT_CURVE_FIDELITY } from './core/geometry/Polygonizer';
export { FontMetadataExtractor } from './core/font/FontMetadata';
export { globalGlyphCache, createGlyphCache } from './core/cache/sharedCaches';
export type { CacheStats } from './utils/LRUCache';

export type {
  TextAlign,
  TextDirection,
  LineInfo,
  LoadedFont,
  HarfBuzzModule,
  HarfBuzzAPI,
  HarfBuzzBlob,
  HarfBuzzFace,
  HarfBuzzFont,
  HarfBuzzBuffer,
  HarfBuzzInstance,
  VariationAxis,
  ExtractedMetrics,
  VerticalMetrics,
  FontMetrics,
  ProcessedGeometry,
  Triangles,
  GlyphData,
  GlyphGeometryInfo,
  TextGeometryInfo,
  TextHandle,
  TextOptions,
  ColorOptions,
  ColorByRange,
  ColoredRange,
  PathInfo,
  HyphenationPatternsMap,
  CurveFidelityConfig,
  LayoutOptions,
  GeometryOptimizationOptions,
  TextRange,
  TextQueryOptions
} from './core/types';

export type { HyphenationTrieNode } from './hyphenation';
