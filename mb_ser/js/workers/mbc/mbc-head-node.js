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
            mt: get_mt({c:0xff,m:0xff,y:0xff}),
            img: dat,
            brightness: '120',
            saturation: '130',
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

