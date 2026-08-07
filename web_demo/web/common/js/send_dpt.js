/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { dat2hex, readable_size, dat_append } from './utils/helper.js'
import { send_command, csa_write } from './ble_common.js'

const sub_size1 = 244 - 2;
const sub_size2 = 495 - 4;

const RP_d_ctrl = 0x01ad;


function prepare_tx_pkts1(dat) {
    const ack_max = 15;
    let cur = 0;
    let pkt_cnt = 0;
    let ack_cnt = 0;
    csa.dpt_pkts = []; // clear
    while (true) {
        let size = Math.min(sub_size1, dat.length - cur);
        if (size == 0)
            break;
        const wdat = dat.slice(cur, cur+size);
        let ack_bit = 0x8;
        if (++ack_cnt >= ack_max || size < sub_size1) {
            ack_bit = 0; // need ack
            ack_cnt = 0;
        }
        const prefix = [0x60 | (pkt_cnt++ & 7) | ack_bit, 20];
        csa.dpt_pkts.push(dat_append(prefix, wdat));
        cur += size;
    }
}

function prepare_tx_pkts2(dat) {
    const ack_max = 31;
    let cur = 0;
    let pkt_cnt = 0;
    let ack_cnt = 0;
    csa.dpt_pkts = []; // clear
    while (true) {
        let size = Math.min(sub_size2, dat.length - cur);
        if (size == 0)
            break;
        const wdat = dat.slice(cur, cur+size);
        if (wdat.length <= 251) {
            const prefix = [0x60 | (pkt_cnt++ & 7), 20];
            csa.dpt_pkts.push(dat_append(prefix, wdat));
        } else {
            let ack_bit = 0x8;
            if (++ack_cnt >= ack_max || size < sub_size2) {
                ack_bit = 0; // need ack
                ack_cnt = 0;
            }
            const prefix0 = [0x68 | (pkt_cnt++ & 7), 20];
            const prefix1 = [0x60 | (pkt_cnt++ & 7) | ack_bit, 20];
            const dat0 = wdat.slice(0, 251);
            const dat1 = wdat.slice(251);
            csa.dpt_pkts.push(dat_append(dat_append(prefix0, dat0), dat_append(prefix1, dat1)));
        }
        cur += size;
    }
}


// map resume position (dptz bytes consumed by printer) to dpt_pkts index;
// half: first sub-frame of a dual-frame entry already received
function resume_idx(pos) {
    let cur = 0;
    for (let i = 0; i < csa.dpt_pkts.length; i++) {
        if (pos == cur)
            return [i, false];
        const e = csa.dpt_pkts[i];
        cur += e.length - (e.length <= 253 ? 2 : 4);
        if (pos < cur)
            return [i, true];
    }
    return [csa.dpt_pkts.length, false];
}

// empty pkt clears recoverable errors and reports progress; its reply has bit7
// of err_flag set and is queued after every pending reply
async function sync_recover(dptz_size) {
    for (let retry = 0; retry < 3; retry++) {
        if (!csa.ble_mosi)
            return -1;
        await send_command(new Uint8Array([0x60, 20]), false);
        while (true) {
            let rx = await csa.ble_rx_q.get(2500);
            if (rx == null)
                break; // resend empty pkt
            if (rx[0] != 20 || !(rx[2] & 0x80))
                continue; // stale reply
            let err = rx[2] & 0x7f;
            let dv = new DataView(rx.buffer);
            let dptz_rx = dv.getUint32(10, true);
            console.log(` - sync: err ${err}, dptz_rx ${dptz_rx}`);
            if (err == 3 || dptz_rx > dptz_size) {
                console.log('unrecoverable, clear draft');
                await csa_write(RP_d_ctrl, new Uint8Array([0x01]));
                return -1;
            }
            return dptz_rx; // 0: restart from the beginning
        }
    }
    return -1;
}

async function write_data(dptz_size) {
    let pend_ret = [];
    let w_idx = 0;
    let w_half = false;
    let progress = -1;
    let err_cnt = 0;
    let err_pos = -1;

    while (true) {
        if (pend_ret.length < 2 && w_idx < csa.dpt_pkts.length) {
            if (csa.conf.debug_level >= 3)
                console.log(` - tx group ... ${pend_ret.length}`);
            while (true) {
                let dat = csa.dpt_pkts[w_idx];
                if (w_half) {
                    dat = dat.slice(253); // second sub-frame only
                    w_half = false;
                }
                await send_command(dat, false);
                w_idx++;
                let last_port = dat.length <= 253 ? dat[0] : dat[253];
                if (!(last_port & 0x8)) {
                    pend_ret.push(last_port);
                    break;
                }
            }
            let last_progress = Math.round(((w_idx + 1) / csa.dpt_pkts.length) * 100);
            if (last_progress > progress) {
                progress = last_progress;
                console.log(`Progress: ${progress}% (${w_idx} / ${csa.dpt_pkts.length})`);
            }

        } else if (pend_ret.length) {
            let rx = await csa.ble_rx_q.get(2500);

            if (rx != null && (rx[0] != 20 || (rx[2] & 0x80))) {
                if (csa.conf.debug_level >= 2)
                    console.log(` - skip rx: ${dat2hex(rx)}`);
                continue; // foreign port or stale sync reply
            }
            if (rx != null && rx[2] == 0) { // no err
                if (rx[1] == pend_ret[0]) {
                    if (csa.conf.debug_level >= 2)
                        console.log(` - rx0 group ... ${pend_ret.length - 1}`);
                    pend_ret.shift();
                } else if (rx[1] == pend_ret[1]) {
                    console.log(` - rx1 group ... ${pend_ret.length - 1}`)
                    pend_ret = []; // clear
                } else {
                    console.log(" - rx port error");
                }
            } else {
                let pos = await sync_recover(dptz_size);
                if (pos < 0)
                    return -1;
                err_cnt = pos > err_pos ? 1 : err_cnt + 1;
                err_pos = pos;
                if (err_cnt > 5) {
                    console.log('no progress, abort');
                    return -1;
                }
                if (pos == dptz_size)
                    console.log(`dptz_rx ${pos}, all data received`);
                else
                    console.log(`dptz_rx ${pos}, resume (was pkt ${w_idx})`);
                [w_idx, w_half] = resume_idx(pos);
                pend_ret = []; // clear
            }
        } else {
            if (csa.conf.debug_level >= 2)
                console.log("rx reply completed");
            break;
        }
    }
    return 0;
}


async function send_dpt(dpt_dat) {
    if (csa.conf.big_mtu && csa.ble_mtu_cur >= 498) {
        console.log(`Preparing data (big MTU) ...`);
        prepare_tx_pkts2(dpt_dat);
    } else {
        console.log(`Preparing data (small MTU) ...`);
        prepare_tx_pkts1(dpt_dat);
    }
    await csa_write(RP_d_ctrl, new Uint8Array([0x10])); // clear file
    console.log(`Writing data ...`);
    let start_time = performance.now();
    let ret = await write_data(dpt_dat.length);
    let end_time = performance.now();
    let delta_time = (end_time - start_time) / 1000;
    let speed = dpt_dat.length / delta_time / 1000;
    if (!ret) {
        console.log(`Data write completed: ${readable_size(dpt_dat.length)} (${csa.prj.dpt.length} B), ` +
                    `${delta_time.toFixed(3)} Sec, ${speed.toFixed(3)} KB/s`);
        await csa_write(RP_d_ctrl, new Uint8Array([0x02])); // submit file
    }
}


export { send_dpt };
