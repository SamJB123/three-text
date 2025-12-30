/**
 * @license
 *
 * Hyphenation patterns for Finnish (fi)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1986, 1988, 1989 Kauko Saarinen
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const fi_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Finnish
export declare const fi_lefthyphenmin: number;

// Default minimum characters after hyphen for Finnish
export declare const fi_righthyphenmin: number;

export default fi_patterns;
