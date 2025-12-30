/**
 * @license
 *
 * Hyphenation patterns for Dutch (nl)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1996 Piet Tutelaers
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const nl_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Dutch
export declare const nl_lefthyphenmin: number;

// Default minimum characters after hyphen for Dutch
export declare const nl_righthyphenmin: number;

export default nl_patterns;
