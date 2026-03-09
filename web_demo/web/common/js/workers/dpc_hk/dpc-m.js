/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import Module from './dpconv.js';


let overlay = {
    print: text => {
        console.log(text);
        if (text.startsWith('dpc: done')) {
            let dpt_dat = dpconv.FS.readFile('output/0.dpt');
            postMessage({'str': text, 'dpt_dat': dpt_dat});
        } else {
            postMessage({'str': text});
        }
    },
    printErr: text => {
        console.error("dpc error", text);
        postMessage({'str': 'dpc: err'});
    },
    quit: status => {
        console.log("dpc quit", status);
        postMessage({'str': `dpc: ret: ${status}`});
    }
};


let dpconv = await Module(overlay);
console.log("dpc init ready");
postMessage({'str': 'dpc: ready'});


onmessage = function (msg) {
    dpconv.FS.writeFile('in.png', msg.data["img"]);
    let args = `in.png -1 --div ${msg.data.div} --dpi-w ${msg.data.dpi_w}`;
    console.log("dpc:", args);
    dpconv.callMain(args.split(' '));
}

