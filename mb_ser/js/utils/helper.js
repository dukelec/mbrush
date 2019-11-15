/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from './lang.js'
import { sha1 as sha1_sw } from '../libs/sha1.js';

async function read_file(file) {
    return await new Promise((resolve, reject) => {
        let reader = new FileReader();

        reader.onload = () => {
            resolve(new Uint8Array(reader.result));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    })
}

async function load_img(img, url) {
    let ret = -1;
    await new Promise(resolve => {
        img.src = url;
        img.onload = () => { ret = 0; resolve(); };
        img.onerror = () => { console.error(`load_img: ${url}`); resolve(); };
    });
    return ret;
}

function date2num() {
    let d = (new Date()).toLocaleString('en-GB');
    let s = d.split(/[^0-9]/);
    return `${s[2]}${s[1]}${s[0]}${s[4]}${s[5]}${s[6]}`;
}

async function sha1(dat) {
    try {
        // crypto.subtle undefined in insecure contexts
        const hashBuffer = await crypto.subtle.digest('SHA-1', dat);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (e) {
        return sha1_sw(dat);
    }
}

// list: ['x', 'y']
// map: {'rotation': 'r'}
function cpy(dst, src, list, map = {}) {
    for (let i of list) {
        if (i in src)
            dst[i] = src[i];
    }
    for (let i in map) {
        if (i in src)
            dst[map[i]] = src[i];
    }
}

// https://stackoverflow.com/questions/47157428/how-to-implement-a-pseudo-blocking-async-queue-in-js-ts
class Queue {
    constructor() {
        // invariant: at least one of the arrays is empty
        this.resolvers = [];
        this.promises = [];
    }
    _add() {
        this.promises.push(new Promise(resolve => {
            this.resolvers.push(resolve);
        }));
    }
    put(t) {
        // if (this.resolvers.length) this.resolvers.shift()(t);
        // else this.promises.push(Promise.resolve(t));
        if (!this.resolvers.length)
            this._add();
        this.resolvers.shift()(t);
    }
    async get(timeout=null) {
        if (!this.promises.length)
            this._add();
        var p = this.promises.shift();
        var t;
        if (timeout) {
            t = setTimeout(this.put.bind(this), timeout, null); // unit: ms
        }
        var ret_val = await p;
        if (timeout)
            clearTimeout(t);
        return ret_val;
    }
    
    // now some utilities:
    empty() { // there are no values available
        return !this.promises.length; // this.length == 0
    }
    is_blocked() { // it's waiting for values
        return !!this.resolvers.length; // this.length < 0
    }
    qsize() {
        return this.promises.length - this.resolvers.length;
    }
    flush() {
        this.resolvers = [];
        this.promises = [];
    }
}


function download_url(data, fileName) {
    var a;
    a = document.createElement('a');
    a.href = data;
    a.download = fileName;
    document.body.appendChild(a);
    a.style = 'display: none';
    a.click();
    a.remove();
};

function download(data, fileName='dat.bin', mimeType='application/octet-stream') {
    var blob, url;
    blob = new Blob([data], {type: mimeType});
    url = window.URL.createObjectURL(blob);
    download_url(url, fileName);
    setTimeout(function() { return window.URL.revokeObjectURL(url); }, 1000);
};

async function fetch_timo(url, attrs={}, ms=2000, retry=0, st_cb=null) {
    let timeout_cnt = 0;
    while (true) {
        const controller = new AbortController();
        attrs.signal = controller.signal;
        const fetchPromise = fetch(url, attrs);
        let timeoutPromise = new Promise(resolve => setTimeout(resolve, ms));
        let response;
        try {
            response = await Promise.race([fetchPromise, timeoutPromise]);
        } catch (e) {
            return null; // response = null;
        }

        if (response) {
            try {
                return await response.json();
            } catch (e) {
                return null;
            }
        } else {
            controller.abort(); // cancel the fetch
            timeout_cnt += 1;
            if (timeout_cnt > retry)
                return null;
            if (st_cb)
                st_cb(timeout_cnt);
        }
    }
}

async function upload(url, data, file_name, st_cb, offset=0) {
    let i = 0;
    let timeout_cnt = 0;
    while (true) {
        const formData = new FormData();
        formData.append('pos', i + offset);
        
        const chunk = data.slice(i, i + 128*1024);
        if (chunk.length == 0) {
            st_cb(`100%`);
            return 0;
        }
        
        formData.append('file', new Blob([chunk]), file_name);
        let attrs = {method: 'POST', body: formData};
        let ret = await fetch_timo(url, attrs, 5000, 3, function() {
            st_cb(`${Math.round(i/data.length*100)}%${'.'.repeat(timeout_cnt)}`);
        });
        if (ret && ret.status == 'err: write error 28') {
            st_cb(L('No space left'));
            return -1;
        }
        if (!ret || ret.status != 'ok') {
            console.log('upload err', ret);
            st_cb(L('Err'));
            return -2;
        }
        st_cb(`${Math.round(i/data.length*100)}%`);
        console.log(`fetch post ret @${i  + offset}, ${chunk.length}:`, ret);
        i += 128*1024;
    }
};


async function obj2blob2u8a(obj) {
    let ret;
    await new Promise(resolve => {
        obj.toBlob((blob) => {
            new Response(blob).arrayBuffer().then(buf => {
                ret = new Uint8Array(buf);
                resolve();
            });
        });
    });
    return ret;
}

export { read_file, load_img, date2num, sha1, cpy, Queue, download, fetch_timo, upload, obj2blob2u8a };
