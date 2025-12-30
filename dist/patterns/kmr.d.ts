/**
 * @license
 *
 * Hyphenation patterns for Kurmanji Kurdish (kmr)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2009 Jörg Knappen, Medeni Shemdê
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const kmr_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Kurmanji Kurdish
export declare const kmr_lefthyphenmin: number;

// Default minimum characters after hyphen for Kurmanji Kurdish
export declare const kmr_righthyphenmin: number;

export default kmr_patterns;
