/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import Module from './dpconv.js';


// Built with EXIT_RUNTIME=1: runtime shuts down after main(), so callMain
// can't be reused. Create a fresh instance per message and drop it after,
// giving clean memory/FS each run (freed by GC).

function make_overlay(get_inst) {
    return {
        print: text => {
            console.log(text);
            if (text.startsWith('dpc: done')) {
                let dpt_dat = get_inst().FS.readFile('output/0.dptz');
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
}


console.log("dpc init ready");
postMessage({'str': 'dpc: ready'});


let busy = false;

onmessage = async function (msg) {
    if (busy) {
        console.error("dpc error", "busy");
        postMessage({'str': 'dpc: err'});
        return;
    }
    busy = true;
    let dpconv = null;
    try {
        dpconv = await Module(make_overlay(() => dpconv));
        dpconv.FS.writeFile('in.png', msg.data["img"]);
        let args = `in.png -1 --div ${msg.data.div} --dpi-w ${msg.data.dpi_w}`;
        console.log("dpc:", args);
        dpconv.callMain(args.split(' '));
    } catch (e) {
        console.error("dpc error", e);
        postMessage({'str': 'dpc: err'});
    } finally {
        dpconv = null; // drop instance, wasm memory freed by GC
        busy = false;
    }
}
