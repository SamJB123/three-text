/**
 * @license
 *
 * Hyphenation patterns for Swedish (sv)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1994 Jan Michael Rynning
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const sv_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Swedish
export declare const sv_lefthyphenmin: number;

// Default minimum characters after hyphen for Swedish
export declare const sv_righthyphenmin: number;

export default sv_patterns;
