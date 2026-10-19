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

// output/N.dptz in file number order (print order)
function read_outputs(inst) {
    let names = inst.FS.readdir('output').filter(n => /^\d+\.dptz$/.test(n));
    names.sort((a, b) => parseInt(a) - parseInt(b));
    return names.map(n => inst.FS.readFile(`output/${n}`));
}

function make_overlay(get_inst) {
    let info = {}; // from the "dpc: {...}" json lines: pieces, out_px, out_mm, per file sizes
    return {
        print: text => {
            console.log(text);
            if (text.startsWith('dpc: {')) {
                try {
                    let js = JSON.parse(text.slice(5));
                    if ('file' in js)
                        (info.files = info.files || [])[js.file] = js;
                    else
                        Object.assign(info, js);
                } catch (e) {
                    console.warn('dpc: json parse error', text);
                }
            }
            if (text.startsWith('dpc: done'))
                postMessage({'str': text, 'files': read_outputs(get_inst()), 'info': info});
            else
                postMessage({'str': text, 'info': info});
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
        const o = msg.data.opts;
        let args = ['in.png', '--div', o.div, '--dpi-w', o.dpi_w, '--cs', o.cs, '--ink', o.ink];
        if (o.multi_row) {
            args.push('--max-w', o.out_w_mm, '--max-h', o.out_h_mm);
            if (o.feather)
                args.push('--feather');
        } else {
            args.push('-1');
        }
        args = args.map(String);
        console.log("dpc:", args.join(' '));
        dpconv.callMain(args);
    } catch (e) {
        console.error("dpc error", e);
        postMessage({'str': 'dpc: err'});
    } finally {
        dpconv = null; // drop instance, wasm memory freed by GC
        busy = false;
    }
}
