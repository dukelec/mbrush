/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

var cache_name = 'mb-_APPVER_';
var cache_pre = [
    '/img/icon.png',
    '/img/secret.svg',
    '/img/offline.svg',
    '/img/bat_0.svg',
    '/img/bat_1.svg',
    '/img/bat_2.svg',
    '/img/bat_3.svg',
    '/img/bat_4.svg',
    '/img/bat_c.svg'
];

var cache_files = {
    //_HASHLIST_
};


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
            dat = new Uint8Array([ ...dat, ...ret.value ]);
        if (ret.done)
            break;
    }
    const sha = await sha256(dat);
    return dat2hex(sha);
}


async function cache_all(event) {
    let r = Math.random();
    console.log(`sw: cache add all, r: ${r}`);
    let cache = await caches.open(cache_name);
    for (let k of cache_pre) {
        let response = await fetch(`${k}?r=${r}`, {cache: 'no-store'});
        const sha = await resp_sha(response.clone());
        if (sha == cache_files[k])
            cache.put(k, response);
        else
            console.warn(`sw: ${k} hash error: ${sha} != ${cache_files[k]}`);
    }
    console.log('sw: cache add all finished');
}

async function handle_request(event) {
    let loc = new URL(event.request.url);
    let k = loc.pathname;

    let cache = await caches.open(cache_name);
    let response = await cache.match(loc.host == location.host ? k : event.request);
    if (response)
        return response;

    if (loc.host == location.host && !k.includes('/cgi-bin/') && !k.includes('/upload/') && (k in cache_files)) {
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
        console.log(`sw: fetch: ${event.request.url}`);
        response = await fetch(event.request, {cache: 'no-store'});
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

