/**
 * @license
 *
 * Hyphenation patterns for Norwegian Nynorsk (nn)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2007 Karl Ove Hufthammer
 *
 * Copying and distribution of this file, with or without modification, are permitted in any medium without royalty, provided the copyright notice and this notice are preserved.
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const nn_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Norwegian Nynorsk
export declare const nn_lefthyphenmin: number;

// Default minimum characters after hyphen for Norwegian Nynorsk
export declare const nn_righthyphenmin: number;

export default nn_patterns;
