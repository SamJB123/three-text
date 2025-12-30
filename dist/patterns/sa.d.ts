/**
 * @license
 *
 * Hyphenation patterns for Sanskrit (sa)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2006-2011 Yves Codet
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const sa_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Sanskrit
export declare const sa_lefthyphenmin: number;

// Default minimum characters after hyphen for Sanskrit
export declare const sa_righthyphenmin: number;

export default sa_patterns;
