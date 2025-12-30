/**
 * @license
 *
 * Hyphenation patterns for Ukrainian (uk)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 1998-2001 Maksym Polyakov
 *
 * name: MIT url: https://opensource.org/licenses/MIT name: LPPL url: https://latex-project.org/lppl/
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const uk_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Ukrainian
export declare const uk_lefthyphenmin: number;

// Default minimum characters after hyphen for Ukrainian
export declare const uk_righthyphenmin: number;

export default uk_patterns;
