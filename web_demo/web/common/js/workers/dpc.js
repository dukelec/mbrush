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


dpc.conv = async function(img_dat, div=2, dpi_w=1000, st_cb) {
    dpc.q.flush();
    dpc.w.postMessage({img: img_dat, div: div, dpi_w: dpi_w});
    while (true) {
        let r = await dpc.q.get();
        
        if (r.str == 'dpc: done') {
            st_cb('100%');
            return r.dpt_dat;
        } else if (r.str == 'dpc: err') {
            st_cb('Err');
            return null;
        } else if (r.str.startsWith('dpc:')) {
            if (r.str == 'dpc: resize image')
                st_cb('20%');
            else if (r.str == 'dpc: convert color')
                st_cb('40%');
            else if (r.str == 'dpc: convert image')
                st_cb('60%')
            else if (r.str == 'dpc: create dpt: 0')
                st_cb('80%');
        }
    }
};

export { dpc };
