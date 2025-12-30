/**
 * @license
 *
 * Hyphenation patterns for Catalan (ca)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) December 1991-January 1995, July 2003 Gonçal Badenes
 *
 * Permissive license - see tex-hyphen project
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const ca_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Catalan
export declare const ca_lefthyphenmin: number;

// Default minimum characters after hyphen for Catalan
export declare const ca_righthyphenmin: number;

export default ca_patterns;
