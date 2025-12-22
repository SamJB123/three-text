# Changelog

## [0.2.14]

### Fixed

- Cache keys now include `curveFidelity` and `geometryOptimization` config to prevent incorrect geometry reuse when options change
- HarfBuzz draw callbacks now shared per module to eliminate WASM function pointer leaks
- React Three Fiber component lifecycle: material disposal now only on unmount, geometry disposal on cancellation
- React Three Fiber `vertexColors` prop now correctly applied to default material
- Extruder depth consistency: side walls now use the same back-face Z clamp for very small depths
- Letter spacing: removed trailing spacing accumulation at line ends to match placement with measurement
- Empty line index bookkeeping when width is undefined
- TrueType Collection (TTC) fonts now properly rejected (only TTF/OTF/WOFF supported)
- Hyphenation pattern loading now validates language codes against safe allowlist
- `LRUCache`: Fixed linked-list invariant where head node's `prev` reference was not cleared, preventing potential corruption during eviction
- `PerformanceLogger`: Fixed nested timing support by using unique timer keys per start operation
- `WebGPU` adapter: Fixed interface to use `indexCount` instead of incorrect `vertexCount` property

### Performance

- `GlyphGeometryBuilder`: Use pre-allocated typed arrays instead of `number[].push()`
- `Extruder`: Pre-compute buffer sizes and write directly to typed arrays
- `Polygonizer` and `PathOptimizer`: Calculate angles using `atan2(cross, dot)` instead of two `atan2()` calls
- `TextRangeQuery`: Bounds calculation uses scalar min/max instead of allocating `Box3` per glyph
- Contour, word, and clustering caches now shared across `Text.create()` calls
- Font ID generation now stable across calls
- `updatePlaneBounds()` uses direct min/max comparisons

### Changed

- `Text.create()` return type simplified to named `TextHandle` interface
- Terser configuration: enabled property mangling (with reserved public API list), 3 compression passes, unsafe optimizations, toplevel mangling
- Cache implementation unified on `utils/LRUCache`
- `GlyphCache.ts` removed, functionality consolidated to `sharedCaches.ts` and `types.ts`
- Cache statistics shape changed to `CacheStats`
- Font table directory parsing extracted to shared `parseTableDirectory()` helper
- Depth clamping now applied consistently in layout preparation and extrusion
- Font cache memory-based eviction policy can now be configured via `Text.setMaxFontCacheMemoryMB()`)

### Added

- Internal benchmark tooling in `bench/` directory
- Text and background color pickers in all examples (ESM, UMD, React Three Fiber)
- `Text.clearFontCache()` method to manually clear cached fonts
- `Text.setMaxFontCacheMemoryMB()` to configure font cache memory limit

## [0.2.13]

### Changed

- Improved glyph caching strategy for clusters

## [0.2.12] - 2025-12-14

### Fixed

- Fixed selective text coloring (`byText`, `byCharRange`) potentially coloring adjacent punctuation when letters overlap

### Changed

- Migrated to `@types/libtess` package from DefinitelyTyped after contributing type definitions upstream

## [0.2.11] - 2025-12-08

### Fixed

- `LineBreak.ts`: Default short line detection threshold increased from 50% to 70% for better balance

## [0.2.10] - 2025-12-08

### Fixed

- `LineBreak.ts`: Fixed demerit logic that was causing poor breakpoint selection

## [0.2.9] - 2025-12-07

### Added

- `Text.create()` now returns an object with an `.update()` method for regenerating text geometry with different options

### Changed

- Example demos now use `.update()`
- Improved demo rendering
- Word cache now uses LRU eviction to prevent unbounded memory growth with dynamic text

### Fixed

- Fixed typo in vectors.ts comment
- Removed unnecessary defensive check in update method
- `LineBreak.ts`: improvements to emergency stretch, threshold handling, and minimum demerits tracking

## [0.2.8] - 2025-12-04

### Added

- Chinese, Japanese, Korean (CJK) now have character-level line breaking / inter-character glue. No breaks before closing punctuation or after opening punctuation
- Mixed script support (automatic switching between CJK and word-based scripts)
- Added `shortLineThreshold` parameter to customize short line detection (default: 0.5)

### Changed

- Hyphenation now on-demand (second pass only if first pass fails)
- Short line detection now checks all lines (not just those with 3 or fewer words)
- Short line detection threshold reduced from 75% to 50% for better balance
- Renamed `disableSingleWordDetection` option to `disableShortLineDetection`

## [0.2.7] - 2025-12-01

### Added

- Polygonized contour cache
- Generic LRU cache in `src/utils/LRUCache.ts`
- Integration tests with real HarfBuzz and fonts
- `npm run benchmark` command for performance measurement

## [0.2.6] - 2025-12-01

### Added

- Added support for OpenType features via `fontFeatures` option in `TextOptions`
- Added `fontFeatures` helper to validate and format feature tags for HarfBuzz

### Changed

- `DebugLogger.ts` has become `Logger.ts` and `debugLogger` is now `logger`
- Optimized font metadata parsing (2x faster) by using integer tag comparisons instead of string decoding

## [0.2.5] - 2025-11-30

### Fixed

- Letter spacing now correctly accounts for trailing spacing in width measurements

## [0.2.4] - 2025-11-26

### Changed

- Switched from `tess2-ts` to `libtess` - submitting type defitinitions to `@types` is a TODO

## [0.2.3] - 2025-11-26

### Fixed

- Three.js adapter now uses `Uint32BufferAttribute` for indices

### Changed

- Examples display render timing showing total time for `Text.create()` call
- Vertex colors are now optional - only added when explicitly provided

## [0.2.2] - 2025-11-24

### Changed

- p5.js adapter now hooks into p5's preload system with `loadThreeTextShaper()` and `loadThreeTextFont()`
- `createThreeTextGeometry()` returns object with `geometry`, `planeBounds`, and `glyphs`
- p5 example tries to stay closer to p5 patterns

## [0.2.1] - 2025-11-24

### Fixed

- Normal vectors are no longer scaled
- Front face normals now point towards viewer

## [0.2.0] - 2025-11-24

### Breaking Changes

**Import paths have changed.** The library is now framework-agnostic with separate adapters:

```javascript
// OLD (v0.1.x)
import { Text } from 'three-text';
import { ThreeText } from 'three-text/react';

// NEW (v0.2.x)
import { Text } from 'three-text/three';
import { Text } from 'three-text/three/react';
```

**Core API changes:**
- Core (`three-text`) now returns raw arrays (`vertices`, `normals`, `indices`)
- Three.js adapter (`three-text/three`) returns `BufferGeometry` (same as before)

### Added

- Framework-agnostic core (zero Three.js dependencies)
- WebGL adapter (`three-text/webgl`)
- WebGPU adapter (`three-text/webgpu`)
- p5.js adapter (`three-text/p5`)
- Custom Vec2, Vec3, Box3Core classes
- Examples for WebGL, WebGPU, and p5.js

### Changed

- React component moved to `three-text/three/react`
- Core returns raw typed arrays instead of BufferGeometry
- All core files use custom vector classes instead of Three.js types

### Fixed

- Build system supports multiple entry points
- TypeScript definitions for all adapters

## [0.1.1] - 2025-11-23

### Fixed

- Numeric map keys
- Removed double curve length calculation

## [0.1.0] - 2025-11-23

Initial alpha release
