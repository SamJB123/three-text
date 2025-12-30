/**
 * @license
 *
 * Hyphenation patterns for Slovak (sk)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1992 Jana Chlebíková
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const sk_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Slovak
export declare const sk_lefthyphenmin: number;

// Default minimum characters after hyphen for Slovak
export declare const sk_righthyphenmin: number;

export default sk_patterns;
