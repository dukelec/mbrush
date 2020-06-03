/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { trans_zh_hk }  from './trans/zh_hk.js'
import { trans_zh_cn }  from './trans/zh_cn.js'
import { trans_ja }     from './trans/ja.js'
import { trans_ko }     from './trans/ko.js'

let trans = null;
if (navigator.language.startsWith('zh')) {
    trans = trans_zh_hk;
    if (navigator.language.includes('CN'))
        trans = trans_zh_cn;
}
if (navigator.language.includes('ja')) // Japanese
    trans = trans_ja;
if (navigator.language.includes('ko')) // Korean
    trans = trans_ko;

function L(ori, mark=null) {
    if (trans == null)
        return ori;
    if (!mark)
        mark = ori;
    return trans[mark] || ori;
}

export { L };
