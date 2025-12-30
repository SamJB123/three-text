/**
 * @license
 *
 * Hyphenation patterns for Serbo-Croatian (Latin) (sh-latn)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1990, 2008 Dejan Muhamedagić
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const sh_latn_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Serbo-Croatian (Latin)
export declare const sh_latn_lefthyphenmin: number;

// Default minimum characters after hyphen for Serbo-Croatian (Latin)
export declare const sh_latn_righthyphenmin: number;

export default sh_latn_patterns;
