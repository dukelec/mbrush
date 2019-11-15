/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { Queue } from '../utils/helper.js';

// bgr
const mt = new Uint8Array([
  0x42, 0x4d, 0x4e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00,
  0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x00,
  0x00, 0x00, 0x23, 0x2e, 0x00, 0x00, 0x23, 0x2e, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0xff, 0x00, 0xff,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0xff, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff
]);

function get_mt(cal) { // max value: 0xff
    let t = new Uint8Array(mt);
    t[0x38] = t[0x41] = t[0x47] = t[0x4a] = 0xff - cal.c;
    t[0x3a] = t[0x40] = t[0x43] = t[0x49] = 0xff - cal.m;
    t[0x3c] = t[0x42] = t[0x45] = t[0x48] = 0xff - cal.y;
    return t;
}

let mbc = {};
mbc.q = new Queue();
mbc.ready = false;
mbc.w = new Worker('js/workers/mbc/mbc-m.js');

mbc.w.onmessage = async msg => {
    let str = msg.data['str'];
    if (str == 'mbc:ready') {
        mbc.ready = true;
        return;
    }
    mbc.q.put(msg.data);
};

mbc.conv = async function(img_dat, brightness=100, saturation=100, density=60, cal={c:0xff,m:0xff,y:0xff},
                          invert=0, c_order=0, c_width=0, dpi_step=1, st_cb) {
    let mt = get_mt(cal);
    mbc.q.flush();
    mbc.w.postMessage({mt: mt, img: img_dat,
                       brightness: String(brightness),
                       saturation: String(saturation),
                       density_n: String(Math.max(100 - density, 1)),
                       invert: invert, c_order: c_order, c_width: c_width, dpi_step: dpi_step});
    while (true) {
        let r = await mbc.q.get();
        
        if (r.str == 'mbc:done') {
            st_cb('100%');
            return r.mb_dat;
        } else if (r.str == 'mbc:err') {
            st_cb(L('Err'));
            return null;
        } else if (r.str.startsWith('mbc:')) {
            if (r.str == 'mbc:p0' || r.str == 'mbc:p1')
                st_cb('20%');
            else if (r.str == 'mbc:p2')
                st_cb('40%');
            else if (r.str == 'mbc:p3')
                st_cb('60%')
            else if (r.str == 'mbc:p4')
                st_cb('80%');
        }
    }
};

export { mbc };
