/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { dat2hex, dat2str, val2hex, dat_append } from './utils/helper.js'

const R_itvl_min = 0x00a6;
const R_mtu_cur = 0x0132;
const RP_voltage = 0x0174;


async function send_command(msg, wait=true, timeout=2500) {
    if (csa.conf.debug_level >= 3)
        console.log(`ble tx (${msg.length}): ${dat2hex(msg)}`)
    try {
        await csa.ble_mosi.writeValueWithoutResponse(msg);
    } catch (error) {
        console.log(`ble_mosi write error: ${error}`);
        return null;
    }
    if (wait) {
        let ret = await csa.ble_rx_q.get(timeout);
        return ret;
    }
}

async function csa_write(offset, dat, proxy=true, timeout=2500, wait=true) {
    const prefix = new Uint8Array([proxy ? 0x60 : 0x40, 0x05, wait ? 0x20 : 0xa0, 0, 0]);
    const view = new DataView(prefix.buffer);
    view.setUint16(3, offset, true);
    csa.ble_rx_q.flush();
    let ret = await send_command(dat_append(prefix, dat), wait, timeout);
    if (wait && (!ret || ret[2] !== 0))
        console.log(`csa_write error at ${val2hex(offset)}: ${dat2hex(dat)}`);
    return ret;
}

async function csa_read(offset, len, proxy=true, timeout=2500) {
    const msg = new Uint8Array([proxy ? 0x60 : 0x40, 0x05, 0x00, 0, 0, len]);
    const view = new DataView(msg.buffer);
    view.setUint16(3, offset, true);
    csa.ble_rx_q.flush();
    let ret = await send_command(msg, true, timeout);
    if (!ret || ret[2] !== 0)
        console.log(`csa_read error at ${val2hex(offset)}, len: ${len}`);
    return ret;
}


function on_ble_notify(event) {
    const value = event.target.value;
    const msg = new Uint8Array(value.buffer);
    if (csa.conf.debug_level >= 2)
        console.log(`ble rx (${msg.length}): ${dat2hex(msg)}`);
    csa.ble_rx_q.put(msg);
}

async function ble_connect() {
    if (!navigator.bluetooth || typeof(navigator.bluetooth.requestDevice) !== "function") {
        console.log('⚠️ Web BLE is not supported in the current browser\n' +
                    ' • iOS users: please use the Bluefy browser\n' +
                    ' • Android users: please use Chrome, Samsung Internet, or Opera\n' +
                    ' • PC users: please use Chrome, Edge, or Opera');
        return;
    }
    try {
        csa.ble_dev = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true, // filters: [{ namePrefix: 'hk24' }]
            optionalServices: ['b3340001-56ba-40b1-8ecb-8fe18dfffddd']
        });

        csa.ble_dev.addEventListener('gattserverdisconnected', () => {
            console.log('Device disconnected');
            csa.ble_miso.removeEventListener('characteristicvaluechanged', on_ble_notify);
            csa.ble_miso = null;
            csa.ble_mosi = null;
            csa.ble_dev = null;
            document.getElementById('connect_btn').disabled = false;
            document.getElementById('disconnect_btn').disabled = true;
            document.getElementById('dev_info_btn').disabled = true;
            document.getElementById('write_dat_btn').disabled = true;
        }, { once: true });

        csa.ble_ser = await csa.ble_dev.gatt.connect();
        console.log('Connected to device');

        const service = await csa.ble_ser.getPrimaryService('b3340001-56ba-40b1-8ecb-8fe18dfffddd');

        csa.ble_miso = await service.getCharacteristic('b3340003-56ba-40b1-8ecb-8fe18dfffddd');
        await csa.ble_miso.startNotifications();
        csa.ble_miso.addEventListener('characteristicvaluechanged', on_ble_notify);
        console.log('Notify characteristic registered');

        csa.ble_mosi = await service.getCharacteristic('b3340002-56ba-40b1-8ecb-8fe18dfffddd');
        console.log('Write characteristic ready');
        document.getElementById('connect_btn').disabled = true;
        document.getElementById('disconnect_btn').disabled = false;
        document.getElementById('dev_info_btn').disabled = false;
        document.getElementById('write_dat_btn').disabled = false;
        await read_dev_info();

    } catch (error) {
        console.log(`Connection failed: ${error}`);
    }
}


async function ble_disconnect() {
    try {
        if (csa.ble_dev && csa.ble_dev.gatt.connected) {
            await csa.ble_miso.stopNotifications();
            csa.ble_dev.gatt.disconnect();
            console.log('Disconnected manually');
        } else {
            console.log('No device connected');
        }
    } catch (error) {
        console.log(`Disconnection failed: ${error}`);
    }
}


async function read_dev_info() {
    if (!csa.ble_mosi)
        return;
    csa.ble_rx_q.flush();
    let ret = await send_command(new Uint8Array([0x40, 0x01]));
    console.log(ret ? `Device info: ${dat2str(ret.slice(2))}` : 'Failed to read device info: timeout');
    ret = await send_command(new Uint8Array([0x60, 0x01]));
    console.log(ret ? `Device info: ${dat2str(ret.slice(2))}` : 'Failed to read device info: timeout');
    ret = await csa_read(R_mtu_cur, 3, false);
    if (!ret || ret[2] !== 0) {
        console.log('Register itvl/mtu read error');
        return;
    }
    let dv = new DataView(ret.buffer);
    csa.ble_mtu_cur = dv.getUint16(3, true);
    let itvl_cur = ret[5];
    ret = await csa_read(R_itvl_min, 2, false);
    if (!ret || ret[2] !== 0) {
        console.log('Register itvl_min read error');
        return;
    }
    let itvl_min = ret[3];
    let itvl_max = ret[4];
    ret = await csa_read(RP_voltage, 4);
    if (!ret || ret[2] !== 0) {
        console.log('Register voltage read error');
        return;
    }
    dv = new DataView(ret.buffer);
    let voltage = dv.getFloat32(3, true);
    console.log(`Register read: mtu_cur: ${csa.ble_mtu_cur}, itvl_cur: ${itvl_cur} ` +
                `(itvl_min: ${itvl_min}, max: ${itvl_max}), battery: ${voltage.toFixed(3)} V`);
}

export {
    send_command, csa_write, csa_read, ble_connect, ble_disconnect, read_dev_info
};
