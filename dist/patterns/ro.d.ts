/**
 * @license
 *
 * Hyphenation patterns for Romanian (ro)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1995-1996 Adrian Rezus
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const ro_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Romanian
export declare const ro_lefthyphenmin: number;

// Default minimum characters after hyphen for Romanian
export declare const ro_righthyphenmin: number;

export default ro_patterns;
