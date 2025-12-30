/**
 * @license
 *
 * Hyphenation patterns for Thai (th)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2012-2013 Theppitak Karoonboonyanan
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const th_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Thai
export declare const th_lefthyphenmin: number;

// Default minimum characters after hyphen for Thai
export declare const th_righthyphenmin: number;

export default th_patterns;
