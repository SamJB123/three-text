/**
 * @license
 *
 * Hyphenation patterns for Latvian (lv)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2004-2005 Janis Vilims
 *
 * name: LGPL version: 2.1 url: http://www.gnu.org/copyleft/lesser.txt name: GPL version: 2 or_later: true url: http://www.gnu.org/licenses/gpl.html
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const lv_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Latvian
export declare const lv_lefthyphenmin: number;

// Default minimum characters after hyphen for Latvian
export declare const lv_righthyphenmin: number;

export default lv_patterns;
