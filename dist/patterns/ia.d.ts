/**
 * @license
 *
 * Hyphenation patterns for Interlingua (ia)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1989-2005 Peter Kleiweg
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const ia_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Interlingua
export declare const ia_lefthyphenmin: number;

// Default minimum characters after hyphen for Interlingua
export declare const ia_righthyphenmin: number;

export default ia_patterns;
