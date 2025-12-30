/**
 * @license
 *
 * Hyphenation patterns for Macedonian (mk)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2006 Vasil Taneski
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const mk_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Macedonian
export declare const mk_lefthyphenmin: number;

// Default minimum characters after hyphen for Macedonian
export declare const mk_righthyphenmin: number;

export default mk_patterns;
