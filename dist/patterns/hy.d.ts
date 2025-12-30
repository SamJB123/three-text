/**
 * @license
 *
 * Hyphenation patterns for Armenian (hy)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2010 Sahak Petrosyan
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const hy_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Armenian
export declare const hy_lefthyphenmin: number;

// Default minimum characters after hyphen for Armenian
export declare const hy_righthyphenmin: number;

export default hy_patterns;
