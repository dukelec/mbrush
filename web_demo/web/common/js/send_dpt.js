/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { dat2hex, readable_size, dat_append } from './utils/helper.js'
import { send_command, csa_write, csa_read } from './ble_common.js'

const sub_size1 = 244 - 2;
const sub_size2 = 495 - 4;

const RP_d_ctrl = 0x01ad;
const RP_w_offset = 0x0248;


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


async function write_data() {
    let pend_ret = [];
    let w_idx = 0;
    let progress = -1;
    const sub_size = csa.dpt_pkts[0].length <= 244 ? sub_size1 : sub_size2;
    
    while (true) {
        if (pend_ret.length < 2 && w_idx < csa.dpt_pkts.length) {
            if (csa.conf.debug_level >= 3)
                console.log(` - tx group ... ${pend_ret.length}`);
            while (true) {
                let dat = csa.dpt_pkts[w_idx];
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
                let retry_cnt = 0;
                while (true) {
                    if (!csa.ble_mosi || ++retry_cnt > 3)
                        return -1;
                    let csa_dat = await csa_read(RP_w_offset, 6);
                    if (csa_dat == null || csa_dat[0] != 5)
                        continue;
                    console.log(` - retry rx: ${dat2hex(csa_dat)}`);
                    let dv = new DataView(csa_dat.buffer);
                    let csa_ofs = dv.getUint32(3, true);
                    let csa_cnt = dv.getUint8(7, true);
                    let csa_err = dv.getUint8(8, true);
                    let ack_idx = Math.floor(csa_ofs / sub_size);
                    let set_ofs = ack_idx * sub_size;
                    let set_cnt = csa.dpt_pkts[ack_idx][0] & 7;
                    console.log(`csa_offset ${csa_ofs} -> ${set_ofs} (${w_idx * sub_size}), cnt ${csa_cnt} -> ${set_cnt}, err ${csa_err}`);
                    let set_dat = new Uint8Array([0x00, 0x00, 0x00, 0x00, set_cnt, 0x00]);
                    dv = new DataView(set_dat.buffer);
                    dv.setInt32(0, set_ofs, true);
                    await csa_write(RP_w_offset, set_dat);
                    w_idx = ack_idx;
                    pend_ret = []; // clear
                    break;
                }
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
    let ret = await write_data();
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
