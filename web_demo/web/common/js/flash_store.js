/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

// dptz files stored in the user data area of the ble board flash, same layout as the firmware
// reads: files back to back, each 4-byte aligned, [len_32][dptz file][crc_16], the chain ends
// at the first erased len word (0xffffffff) or an invalid header.
// The device sends file 0 to the printer at power-up, the next one after each print job
// (wrapping around), file 0 again after a force stop.

import { val2hex, dat2str, crc16, dat_append, readable_size } from './utils/helper.js'
import { send_command, csa_write } from './ble_common.js'

const R_dptz_reload = 0x012a;

const FLASH_BASE = 0x187000;
const FLASH_END = 0x3ff000;
const SECTOR = 4096;
const ERASE_MAX = 0x10000;  // per erase command, keep the reply inside the timeout
const WRITE_SUB = 128;      // bytes per write packet
const FILES_MAX = 255;

function align_up(val, align) {
    return Math.ceil(val / align) * align;
}

function cmd_hdr(sub, addr) {
    let cmd = new Uint8Array([0x40, 0x08, sub, 0, 0, 0, 0]);
    new DataView(cmd.buffer).setUint32(3, addr, true);
    return cmd;
}

async function flash_read(addr, len) {
    let cmd = dat_append(cmd_hdr(0x00, addr), new Uint8Array([len]));
    csa.ble_rx_q.flush();
    let ret = await send_command(cmd);
    if (!ret || ret[2] !== 0 || ret.length != len + 3) {
        console.log(`Flash read error at ${val2hex(addr)}, len: ${len}`);
        return null;
    }
    return ret.slice(3);
}

async function flash_erase(addr, len) {
    for (let ofs = 0; ofs < len; ) {
        let sub = Math.min(ERASE_MAX - (addr + ofs) % ERASE_MAX, len - ofs); // split at 64KB blocks
        let cmd = new Uint8Array(11);
        cmd.set(cmd_hdr(0x2f, addr + ofs));
        new DataView(cmd.buffer).setUint32(7, sub, true);
        let ret = null;
        for (let i = 0; i < 3 && (!ret || ret[2] !== 0); i++) {
            csa.ble_rx_q.flush();
            ret = await send_command(cmd, true, 5000);
        }
        if (!ret || ret[2] !== 0) {
            console.log(`Flash erase error at ${val2hex(addr + ofs)}, len: ${sub}`);
            return -1;
        }
        ofs += sub;
    }
    return 0;
}

async function flash_write(addr, dat) {
    for (let ofs = 0; ofs < dat.length; ofs += WRITE_SUB) // 0xa0: write, no reply
        await send_command(dat_append(cmd_hdr(0xa0, addr + ofs), dat.slice(ofs, ofs + WRITE_SUB)), false);
}

async function flash_crc(addr, len, timeout=2500) {
    let cmd = new Uint8Array(11);
    cmd.set(cmd_hdr(0x10, addr));
    new DataView(cmd.buffer).setUint32(7, len, true);
    csa.ble_rx_q.flush();
    let ret = await send_command(cmd, true, timeout);
    if (!ret || ret[2] !== 0 || ret.length != 5) {
        console.log(`Flash crc read error at ${val2hex(addr)}, len: ${len}`);
        return null;
    }
    return new DataView(ret.buffer).getUint16(3, true);
}


// walk the file chain, return {files: [{addr, len, ok}], end, free}, null on read error;
// ok: the device-side crc over [dptz][crc_16] is zero (a file cut short by a lost connection
// still occupies its space, the device skips it)
async function flash_scan() {
    let files = [];
    let a = FLASH_BASE;
    while (files.length < FILES_MAX && a + 4 <= FLASH_END) {
        let hdr = await flash_read(a, 12);
        if (!hdr)
            return null;
        let len = new DataView(hdr.buffer).getUint32(0, true);
        if (len == 0xffffffff)
            break;
        if ((len >>> 24) != 0 || len < 64 || a + 4 + len + 2 > FLASH_END ||
                dat2str(hdr.slice(4, 10)) != 'DPrint' || hdr[11] != 2) {
            console.log(`Flash: invalid file header at ${val2hex(a)}, end of list`);
            break;
        }
        let crc = await flash_crc(a + 4, len + 2, 5000);
        if (crc === null)
            return null;
        files.push({addr: a, len: len, ok: crc === 0});
        a = align_up(a + 4 + len + 2, 4);
    }
    return {files: files, end: a, free: FLASH_END - a};
}

// refresh the flash usage shown on the page, return the scan result
async function flash_update_info() {
    let elem = document.getElementById('flash_info');
    if (!csa.ble_mosi) {
        elem.innerText = '';
        return null;
    }
    let info = await flash_scan();
    if (!info) {
        elem.innerText = 'Flash: read error';
        return null;
    }
    let bad = info.files.filter(f => !f.ok).length;
    elem.innerText = `Flash: ${info.files.length} image(s)${bad ? ` (${bad} bad)` : ''}, ${readable_size(info.free)} free`;
    let list = info.files.map((f, i) => `#${i}: ${val2hex(f.addr)} ${readable_size(f.len)}${f.ok ? '' : ' CRC ERROR'}`).join(', ');
    console.log(`Flash images: ${info.files.length}, used: ${readable_size(info.end - FLASH_BASE)}, ` +
                `free: ${readable_size(info.free)}${list ? ' (' + list + ')' : ''}`);
    return info;
}

// tell the device the files changed: it clears the printer and sends file 0 again
async function flash_reload() {
    let ret = await csa_write(R_dptz_reload, new Uint8Array([0x01]), false);
    if (ret && ret[2] === 0)
        console.log('Device reloads the first image from flash');
}

// erase the stored files (the used range plus the len word after it)
async function flash_clear() {
    let info = await flash_scan();
    if (!info)
        return -1;
    let len = Math.min(align_up(info.end + 4, SECTOR), FLASH_END) - FLASH_BASE;
    console.log(`Flash: erasing ${readable_size(len)} ...`);
    if (await flash_erase(FLASH_BASE, len))
        return -1;
    console.log('Flash: all images cleared');
    await flash_reload();
    await flash_update_info();
    return 0;
}

// append a dptz file after the stored ones
async function flash_append(dpt) {
    let info = await flash_update_info();
    if (!info)
        return -1;
    if (info.files.length >= FILES_MAX) {
        console.log(`Too many images in flash (${info.files.length}), clear flash data first`);
        return -1;
    }
    let hdr = new Uint8Array(4);
    new DataView(hdr.buffer).setUint32(0, dpt.length, true);
    let crc = crc16(dpt);
    let blob = dat_append(dat_append(hdr, dpt), new Uint8Array([crc & 0xff, crc >> 8]));
    let pad = new Uint8Array(align_up(blob.length, 4) - blob.length).fill(0xff);
    blob = dat_append(blob, pad);
    if (blob.length > info.free) {
        let msg = `Not enough flash space: image needs ${readable_size(blob.length)}, ` +
                  `only ${readable_size(info.free)} free. Clear flash data first.`;
        console.log(msg);
        alert(msg);
        return -1;
    }
    let addr = info.end;
    console.log(`Flash: write image #${info.files.length} at ${val2hex(addr)}, ${readable_size(blob.length)} ...`);

    // erase the sectors fully behind the previous file, up to the len word after the new one
    // (must read erased); the head shares a sector with the previous file and is still erased
    let e0 = align_up(addr, SECTOR);
    let e1 = Math.min(align_up(addr + blob.length + 4, SECTOR), FLASH_END);
    if (e1 > e0 && await flash_erase(e0, e1 - e0))
        return -1;

    let progress = -1;
    let times = Math.ceil(blob.length / SECTOR);
    for (let i = 0; i < times; i++) {
        let ofs = i * SECTOR;
        let dat = blob.slice(ofs, ofs + SECTOR);
        let ok = false;
        // lost packets leave 0xff behind, writing the same data again is safe without erase
        for (let r = 0; r < 3 && !ok; r++) {
            await flash_write(addr + ofs, dat);
            let rd = await flash_crc(addr + ofs, dat.length);
            ok = (rd === crc16(dat));
            if (!ok)
                console.log(`Flash: crc mismatch at ${val2hex(addr + ofs)}, retry`);
        }
        if (!ok) {
            console.log('Flash write error, clear flash data and try again');
            return -1;
        }
        let last_progress = Math.round(((i + 1) / times) * 100);
        if (last_progress != progress) {
            progress = last_progress;
            console.log(`Flash write in progress: ${progress}% (${i + 1} / ${times})`);
        }
    }
    console.log(`Flash: image #${info.files.length} saved`);
    await flash_reload();
    await flash_update_info();
    return 0;
}

export { flash_update_info, flash_clear, flash_append };
