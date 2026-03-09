/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { sleep, dat2hex, dat2str, val2hex, crc16, dat_append } from './utils/helper.js'
import { send_command, csa_write, csa_read } from './ble_common.js'

const Rx_do_reboot = 0x0005;
const block_size = 4096;


async function ota_enter_bl() {
    for (let i = 0; i < 3; i++) {
        let ret = await send_command(new Uint8Array([0x60, 0x01]));
        if (!ret) {
            console.log(`Failed to read device info: timeout`);
            continue;
        }
        let info = dat2str(ret.slice(2));
        if (info.search('(bl)') > 0)
            return 0;
        await csa_write(Rx_do_reboot, new Uint8Array([0x01]), undefined, undefined, false);
        await sleep(2000);
    }
    return -1;
}


async function write_block(addr, dat, proxy=true) {
    const src_port = proxy ? 0x60 : 0x40;
    for (let i = 0; i < 3; i++) {
        let cmd = new Uint8Array([src_port, 0x08,  0x2f,  0, 0, 0, 0,  0, 0, 0, 0]);
        let dv = new DataView(cmd.buffer);
        dv.setUint32(3, addr, true);
        dv.setUint32(7, block_size, true);
        let ret = await send_command(cmd);
        if (!ret || ret[2] !== 0) {
            console.log(`Page erase error: ${val2hex(addr)}, proxy: ${proxy}`);
            await sleep(1000);
            continue;
        }
        let times = Math.ceil(dat.length / 128);
        for (let x = 0; x < times; x++) {
            let prefix = new Uint8Array([src_port, 0x08,  0xa0,  0, 0, 0, 0]); // no reply
            let dv = new DataView(prefix.buffer);
            dv.setUint32(3, addr + x * 128, true);
            let sub_dat = dat.slice(x * 128, x * 128 + 128);
            await send_command(dat_append(prefix, sub_dat), false);
        }
        cmd = new Uint8Array([src_port, 0x08,  0x10,  0, 0, 0, 0,  0, 0, 0, 0]);
        dv = new DataView(cmd.buffer);
        dv.setUint32(3, addr, true);
        dv.setUint32(7, dat.length, true);
        ret = await send_command(cmd);
        if (!ret || ret[2] !== 0) {
            console.log(`CRC read error: ${val2hex(addr)}, len: ${dat.length}, proxy: ${proxy}`);
            await sleep(1000);
            continue;
        }
        dv = new DataView(ret.buffer);
        let crc_read_back = dv.getUint16(3, true);
        let crc_local = crc16(dat);
        if (crc_read_back == crc_local)
            return 0;
        console.log(`CRC mismatch: read_back: ${val2hex(crc_read_back)}, local: ${val2hex(crc_local)}`);
        await sleep(1000);
    }
    return -1;
}


async function ota_write(bin_dat, start_addr, is_at32=true) {
    if (is_at32) {
        console.log(`Entering bootloader...`);
        let ret = await ota_enter_bl();
        if (ret)
            return;
    }
    console.log(`OTA staring...`);
    let progress = -1;
    let times = Math.ceil(bin_dat.length / block_size);
    for (let i = 0; i < times; i++) {
        let dat = bin_dat.slice(i * block_size, i * block_size + block_size);
        let ret = await write_block(start_addr + block_size * i, dat, is_at32);
        if (ret)
            return;
        let last_progress = Math.round(((i + 1) / times) * 100);
        if (last_progress != progress) {
            progress = last_progress;
            console.log(`OTA in progress: ${progress}% (${i} / ${times})`);
        }
    }
    console.log(`OTA completed, rebooting...`);
    await csa_write(Rx_do_reboot, new Uint8Array([0x02]), is_at32, undefined, false);
    console.log(`Reboot completed`);
}


export { ota_write };
