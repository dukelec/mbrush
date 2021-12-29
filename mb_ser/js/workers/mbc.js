/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { Queue } from '../utils/helper.js';

// bgr
const mt_bmp = new Uint8Array([
  0x42, 0x4d, 0x4e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00,
  0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x00,
  0x00, 0x00, 0x23, 0x2e, 0x00, 0x00, 0x23, 0x2e, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xef, 0xad, 0x00, 0x8c, 0x00, 0xed,
  0x00, 0xf2, 0xfe, 0x92, 0x31, 0x2e, 0x24, 0x1b, 0xed, 0x52, 0xa6, 0x00,
  0x1c, 0x18, 0x1d, 0xff, 0xff, 0xff
]);

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

mbc.conv = async function(img_dat, brightness=100, saturation=100, density=60,
                          invert=0, c_order=0, c_width=0, dpi_step=1, st_cb) {
    mbc.q.flush();
    mbc.w.postMessage({mt: mt_bmp, img: img_dat,
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
