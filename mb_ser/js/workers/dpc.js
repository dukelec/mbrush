/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { Queue } from '../utils/helper.js';

let dpc = {};
dpc.q = new Queue();
dpc.ready = false;
dpc.w = new Worker('js/workers/dpc/dpc-m.js', {type: "module"});

dpc.w.onmessage = async msg => {
    let str = msg.data['str'];
    if (str == 'dpc:ready') {
        dpc.ready = true;
        return;
    }
    dpc.q.put(msg.data);
};

dpc.conv = async function(img_dat, brightness=100, saturation=100, density=60,
                          invert=0, is_cym=0, is_old=0, encoder_div=1, st_cb) {
    dpc.q.flush();
    dpc.w.postMessage({img: img_dat, brightness: brightness, saturation: saturation, density: density,
                       invert: invert, is_cym: is_cym, is_old: is_old, encoder_div: encoder_div});
    while (true) {
        let r = await dpc.q.get();
        
        if (r.str == 'dpc: done') {
            st_cb('100%');
            return r.mb_dat;
        } else if (r.str == 'dpc: err') {
            st_cb(L('Err'));
            return null;
        } else if (r.str.startsWith('dpc:')) {
            if (r.str == 'dpc: enhance color')
                st_cb('20%');
            else if (r.str == 'dpc: resize image')
                st_cb('40%');
            else if (r.str == 'dpc: convert image')
                st_cb('60%')
            else if (r.str == 'dpc: create mbd: 0')
                st_cb('80%');
        }
    }
};

export { dpc };
