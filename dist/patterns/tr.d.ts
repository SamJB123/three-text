/**
 * @license
 *
 * Hyphenation patterns for Turkish (tr)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1987 Pierre A. MacKay, 2008, 2011 TUG
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const tr_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Turkish
export declare const tr_lefthyphenmin: number;

// Default minimum characters after hyphen for Turkish
export declare const tr_righthyphenmin: number;

export default tr_patterns;
