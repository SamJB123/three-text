/**
 * @license
 *
 * Hyphenation patterns for Russian (ru)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1999-2003 Alexander I. Lebedev
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const ru_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Russian
export declare const ru_lefthyphenmin: number;

// Default minimum characters after hyphen for Russian
export declare const ru_righthyphenmin: number;

export default ru_patterns;
