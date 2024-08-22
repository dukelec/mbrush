/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import Module from './dpconv.js';


let overlay = {
    print: text => {
        console.log(text);
        if (text.startsWith('dpc: done')) {
            let mb_dat = dpconv.FS.readFile('output/0.mbd');
            postMessage({'str': text, 'mb_dat': mb_dat});
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
        postMessage({'str': 'dpc: err'});
    }
};


let dpconv = await Module(overlay);
console.log("mb init ready");
postMessage({'str': 'dpc:ready'});


onmessage = function (msg) {
    dpconv.FS.writeFile('in.png', msg.data["img"]);
    let args = `in.png -1 --cb ${msg.data.brightness} --cs ${msg.data.saturation} --cd ${msg.data.density} --div ${msg.data.encoder_div}`;
    args += msg.data.is_cym ? ' --cym' : '';
    args += msg.data.is_old ? ' --old' : '';
    args += msg.data.invert ? ' --inv-d' : '';
    if (msg.data.encoder_div == 1)
        args += ' --dpi-w 1212'
    else if (msg.data.encoder_div == 2)
        args += ' --dpi-w 606'
    else if (msg.data.encoder_div == 4)
        args += ' --dpi-w 303'

    console.log("dpc:", args);
    dpconv.callMain(args.split(' '));
}

