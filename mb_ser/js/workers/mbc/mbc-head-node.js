#!/usr/bin/env node
//
// Copyright (c) 2019, Kudo, Inc.
// All rights reserved.
//
// Author: Duke Fong <d@d-l.io>
//

let ofs = require('fs'); // outside fs
let in_file, out_file;

if (process.argv.length != 4) {
    console.log(`Usage: ${__filename} img.png x.mbd`);
    process.exit(-1);
} else {
    in_file = process.argv[2];
    out_file = process.argv[3];
    console.log(`convert ${in_file} to ${out_file}`);
}


Module = {
    noInitialRun: true,
    moduleLoaded: false,

    print: text => {
        console.log(text);
    },
    printErr: text => {
        console.error("mbc error", text);
    },
    quit: status => {
        console.log("mbc quit", status);
    }
};

Module.onRuntimeInitialized = async function () {
    console.log("mb init ready");
    let dat = ofs.readFileSync(in_file);

    mbc_conv({
        data: {
            mt: mt_bmp,
            img: dat,
            brightness: '100',
            saturation: '100',
            density_n: '40', // 100 - 60%
            invert: 0, c_order: 0, c_width: 0, dpi_step: 2
        }
    });

    let mb_dat = FS.readFile('mb.dat');
    console.log("convert done, saving to file...");
    ofs.writeFileSync(out_file, mb_dat);
}

function mbc_conv(msg) {
    FS.writeFile('m.bmp', msg.data["mt"]);
    FS.writeFile('ori.png', msg.data["img"]);
    let a = [
        msg.data['brightness'], msg.data['saturation'], msg.data["density_n"],
        `-i${msg.data.invert}`, `-o${msg.data.c_order}`, `-w${msg.data.c_width}`, `-s${msg.data.dpi_step}`
    ];
    console.log("mbc conv:", a);
    Module.callMain(a);
}


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

