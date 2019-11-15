/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

Module = {
    noInitialRun: true,
    moduleLoaded: false,

    print: text => {
        console.log(text);
        if (text.startsWith('mbc:done')) {
            let mb_dat = FS.readFile('mb.dat');
            postMessage({'str': text, 'mb_dat': mb_dat});
        } else {
            postMessage({'str': text});
        }
    },
    printErr: text => {
        console.error("mbc error", text);
        postMessage({'str': 'mbc:err'});
    },
    quit: status => {
        console.log("mbc quit", status);
        postMessage({'str': 'mbc:err'});
    }
};

Module.onRuntimeInitialized = async function () {
    console.log("mb init ready");
    postMessage({'str': 'mbc:ready'});
}

onmessage = function (msg) {
    FS.writeFile('m.bmp', msg.data["mt"]);
    FS.writeFile('ori.png', msg.data["img"]);
    let a = [
        msg.data['brightness'], msg.data['saturation'], msg.data["density_n"],
        `-i${msg.data.invert}`, `-o${msg.data.c_order}`, `-w${msg.data.c_width}`, `-s${msg.data.dpi_step}`
    ];
    console.log("mbc:", a);
    Module.callMain(a);
}

