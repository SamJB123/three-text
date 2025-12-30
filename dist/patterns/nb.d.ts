/**
 * @license
 *
 * Hyphenation patterns for Norwegian Bokmål (nb)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2004–2005 Rune Kleveland, Ole Michael Selberg, 2007 Karl Ove Hufthammer
 *
 * Copying and distribution of this file, with or without modification, are permitted in any medium without royalty, provided the copyright notice and this notice are preserved.
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const nb_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Norwegian Bokmål
export declare const nb_lefthyphenmin: number;

// Default minimum characters after hyphen for Norwegian Bokmål
export declare const nb_righthyphenmin: number;

export default nb_patterns;
