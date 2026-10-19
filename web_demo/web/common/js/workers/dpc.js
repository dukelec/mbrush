/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { Queue } from '../utils/helper.js';

let dpc = {};
dpc.q = new Queue();
dpc.ready = false;

dpc.init = function(name='dpc_hk') {
    dpc.w = new Worker(`js/workers/${name}/dpc-m.js`, {type: "module"});
    dpc.w.onmessage = async msg => {
        let str = msg.data['str'];
        if (csa.conf.debug_level >= 2)
            console.log(str);
        if (str == 'dpc: ready') {
            dpc.ready = true;
            return;
        }
        dpc.q.put(msg.data);
    };
};


// opts: {div, dpi_w, cs, ink, multi_row, out_w_mm, out_h_mm, feather}
// return {files: [Uint8Array, ...] in print order, info: {pieces, out_px, out_mm, files: [...]}}
dpc.conv = async function(img_dat, opts, st_cb) {
    dpc.q.flush();
    dpc.w.postMessage({img: img_dat, opts: opts});
    while (true) {
        let r = await dpc.q.get();
        
        if (r.str == 'dpc: done') {
            st_cb('100%');
            return {files: r.files, info: r.info};
        } else if (r.str == 'dpc: err') {
            st_cb('Err');
            return null;
        } else if (r.str.startsWith('dpc:')) {
            if (r.str == 'dpc: resize image')
                st_cb('10%');
            else if (r.str == 'dpc: convert color')
                st_cb('20%');
            else if (r.str == 'dpc: convert image')
                st_cb('40%')
            else if (r.str.startsWith('dpc: create dpt: ')) {
                let n = parseInt(r.str.slice(17));
                let pieces = r.info.pieces || 1;
                st_cb(`${Math.round(40 + 60 * n / pieces)}%`);
            }
        }
    }
};

export { dpc };
