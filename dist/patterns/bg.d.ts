/**
 * @license
 *
 * Hyphenation patterns for Bulgarian (bg)
 *
 * URL: http://www.hyphenation.org/tex
 * Source: hyph-utf8 project
 *
 * Copyright (C) 2000, 2004, 2017 Anton Zinoviev
 *
 * This software may be used, modified, copied, distributed, and sold, both in source and binary form provided that the above copyright notice and these terms are retained. The name of the author may not be used to endorse or promote products derived from this software without prior permission.  THIS SOFTWARE IS PROVIDES "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.
 *
 */

export interface HyphenationTrieNode {
  patterns: number[] | null;
  children: { [char: string]: HyphenationTrieNode };
}

declare const bg_patterns: HyphenationTrieNode;

// Default minimum characters before hyphen for Bulgarian
export declare const bg_lefthyphenmin: number;

// Default minimum characters after hyphen for Bulgarian
export declare const bg_righthyphenmin: number;

export default bg_patterns;
