/*
 * Software License Agreement (MIT License)
 *
 * Author: Duke Fong <d@d-l.io>
 */

// update file list by gen_sw_list.sh

var cache_name = 'hk24-1.8';
var cache_files = {
    "/hk24/img/icon.png" : "f60de1de67d87f4984317c173e5f63dfa8d6b141e23f749f64154b94fdbb57a4",
    "/hk24/js/workers/dpc_hk24/dpc-m.js" : "48a83768e166bda102213e6982ae2c95eccbc2e1fcdb393732d1f8960c1b983a",
    "/hk24/js/workers/dpc_hk24/dpconv.js" : "0f6adcc5ca62170cc6e2915e084013ced5448819aaa7d5641e7af990bed03e9a",
    "/hk24/js/workers/dpc_hk24/dpconv.wasm" : "d01d889727c59b041e25d9e48d1c5de82d9adf8b33882a8d58b8afcb61d97749",
    "/hk24/js/workers/dpc.js" : "94b7e8abad899d6e0f45c44ca541dd6310e438c048ff621b2906f0e6cc1c65bc",
    "/hk24/js/utils/helper.js" : "ae4ccb2104e190e2543f2ee950f708298924de3c7aa44bb62b54884897f47708",
    "/hk24/js/utils/idb.js" : "cb280305f4fd0cc5da5bd1364e172be79bddd50e85bfe5bf45a403602efc6432",
    "/hk24/js/send_dpt.js" : "5b089fc8de2468d9693465d08c92ccb6bff7f7dae5ec8a904b8c678f9b430237",
    "/hk24/js/app.js" : "2b976625228bb0099c8f7479e3f40caba6b53c5c643bdf24e011abbc95b8139f",
    "/hk24/js/ble_common.js" : "d7558cf9e039171228e700d00578dcdecf43fc55d93c7c7609478bba8271d23a",
    "/hk24/js/ota.js" : "60689bff504670208951affde8f23f3092df87b28fc6e2eed80f7a13f8227fb1",
    "/hk24/manifest.json" : "11fad839643c5a7a3a7503b983d297dec59dda578af4b1912a5735a8f9a82567",
    "/hk24/" : "61a03dafafdc079e750df8b4e7707dab84ea7c0e0e411d5f699460a990126f82",
    "/hk24/css/fontawesome-7.0.1.all.min.css" : "f6c5904966ef29cecdbc1d8d87240ac0fd595532db6475143e0e220924c688d0",
    "/hk24/css/bulma-1.0.2.css" : "113149035b8b7543113ca93d6f8c75a7ff4a73a1c0877d5e50c710aa1fe5f404",
    "/hk24/webfonts/fa-solid-900.woff2" : "ff6d96ef6f1b29124a8daa657809d480d7278401ab16320fdb3edf0b658d6492"
};


function dat_append(dat0, dat1) {
    let dat = new Uint8Array(dat0.length + dat1.length);
    dat.set(dat0);
    dat.set(dat1, dat0.length);
    return dat;
}

async function sha256(dat) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', dat);
    return new Uint8Array(hashBuffer);
}

function dat2hex(dat, join='') {
    const dat_array = Array.from(dat);
    return dat_array.map(b => b.toString(16).padStart(2, '0')).join(join);
}

async function resp_sha(resp) {
    const reader = resp.body.getReader();
    let dat = new Uint8Array();
    while (true) {
        const ret = await reader.read();
        if (ret.value && ret.value.length)
            dat = dat_append(dat, ret.value);
        if (ret.done)
            break;
    }
    const sha = await sha256(dat);
    return dat2hex(sha);
}


async function cache_all(event) {
    let r = Math.random();
    console.log(`sw: cache: add all, r: ${r}`);
    let cache = await caches.open(cache_name);
    for (let k in cache_files) {
        let response = await fetch(`${k}?r=${r}`, {cache: 'no-store'});
        const sha = await resp_sha(response.clone());
        if (sha == cache_files[k])
            cache.put(k, response);
        else
            console.warn(`sw: ${k} hash error: ${sha} != ${cache_files[k]}`);
    }
    console.log('sw: cache: add all finished');
}

async function handle_request(event) {
    let loc = new URL(event.request.url);
    let k = loc.pathname;

    let cache = await caches.open(cache_name);
    let response = await cache.match(loc.host == location.host ? k : event.request);
    if (response)
        return response;

    if (loc.host == location.host && (k in cache_files)) {
        let r = Math.random();
        response = await fetch(`${k}?r=${r}`, {cache: 'no-store'});
        const sha = await resp_sha(response.clone());
        if (sha == cache_files[k]) {
            console.log(`sw: add ${k} to cache`);
            cache.put(k, response.clone());
        } else {
            console.warn(`sw: ${k} hash still error: ${sha} != ${cache_files[k]}`);
        }
    } else {
        if (loc.protocol == 'http:' && loc.hostname != 'localhost') {
            console.log(loc);
            console.log(`sw: force https: ${loc.href}`)
            loc.protocol = 'https:';
            response = await fetch(loc);
        } else {
            console.log(loc);
            console.log(`sw: fetch: ${event.request.url}`);
            response = await fetch(event.request);
        }
    }
    return response;
}

async function handle_activate(event) {
    let c_keys = await caches.keys();
    for (let c of c_keys) {
        if (c != cache_name) {
            console.log(`sw: del: ${c}`);
            await caches.delete(c);
        } else {
            console.log(`sw: retain: ${c}`);
        }
    }
}


self.addEventListener('install', event => {
    event.waitUntil(cache_all(event));
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(handle_request(event));
});

self.addEventListener('activate', event => {
    event.waitUntil(handle_activate(event));
    event.waitUntil(clients.claim());
});

