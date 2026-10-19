/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { Idb } from './utils/idb.js';
import { Queue, sleep, read_file, val2hex, load_img, img2png, hex2bin, download, readable_size } from './utils/helper.js';
import { send_command, csa_write, csa_read, ble_connect, ble_disconnect, read_dev_info } from './ble_common.js';
import { send_dpt } from './send_dpt.js';
import { ota_write } from './ota.js';
import { flash_update_info, flash_reload, flash_clear, flash_append } from './flash_store.js';
import { dpc } from './workers/dpc.js';

const R_save_conf = 0x0007;
const R_itvl_min = 0x00a6;
const R_p_state = 0x0131; // printer state mirrored by the ble board: bit2 printing, low 3 bits 0 idle


window.csa = {
    db: null,
    dpt_pkts: [],
    
    ble_dev: null,
    ble_ser: null,
    ble_rx_q: null,
    ble_mosi: null,
    ble_miso: null,
    
    cur_cnt: 0,
    
    def_prj: {
        fmt_ver: '1.1',
        png_dat: null,
        dpts: [],       // converted .dptz files in print order, one per row in multi-row mode
        info: null      // dpconv report: pieces, out_px, out_mm
    },
    prj: null,
    multi_busy: false,  // multi-row direct transfer running
    multi_abort: false,
    
    def_conf: {
        fmt_ver: '1.0',
        debug_level: 1,
        log_max_len: 5000,
        write_flash: false,
        big_mtu: false,
        save_conf: false,
        ble_itvl_min: 6,
        ble_itvl_max: 12,
        multi_row: false,
        out_w_mm: 50,   // max print size in multi-row mode, the image keeps its aspect ratio
        out_h_mm: 50,
        feather: true,  // feather the seam between rows
        cs: 100,        // saturation %
        ink: 100        // ink amount %
    },
    conf: null,
    
    ble_mtu_cur: 0,
    ota_bin: null,
    first_install: false,
    
    conv_dpi_w: 1000,
    conv_div: 2
};


const log_elem = document.getElementById('log');
const _log = console.log;
console.log = function(...args) {
    _log.apply(console, args);
    log_elem.value += args[0] + '\n';
    if (log_elem.value.length > csa.conf.log_max_len)
        log_elem.value = log_elem.value.slice(log_elem.value.length - csa.conf.log_max_len);
    if (log_elem.scrollTop + log_elem.clientHeight >= log_elem.scrollHeight - 50)
        log_elem.scrollTop = log_elem.scrollHeight;
};
document.getElementById('clear_log_btn').onclick = () => {
    log_elem.value = '';
};


function csa_to_page()
{
    document.getElementById('debug_level').value = csa.conf.debug_level;
    document.getElementById('log_max_len').value = csa.conf.log_max_len;
    document.getElementById('write_flash_en').checked = csa.conf.write_flash;
    document.getElementById('big_mtu_en').checked = csa.conf.big_mtu;
    document.getElementById('save_conf_en').checked = csa.conf.save_conf;
    document.getElementById('itvl_min').value = csa.conf.ble_itvl_min;
    document.getElementById('itvl_max').value = csa.conf.ble_itvl_max;
    document.getElementById('multi_row_en').checked = csa.conf.multi_row;
    document.getElementById('out_w_mm').value = csa.conf.out_w_mm;
    document.getElementById('out_h_mm').value = csa.conf.out_h_mm;
    document.getElementById('feather_en').checked = csa.conf.feather;
    document.getElementById('conv_cs').value = csa.conf.cs;
    document.getElementById('conv_ink').value = csa.conf.ink;
    for (let id of ['out_w_mm', 'out_h_mm', 'feather_en'])
        document.getElementById(id).disabled = !csa.conf.multi_row;
}

// read a numeric input, clamp it and write the clamped value back
function num_input(id, min, max, dft) {
    let elem = document.getElementById(id);
    let val = Number(elem.value);
    if (!elem.value.trim() || isNaN(val))
        val = dft;
    val = Math.min(max, Math.max(min, val));
    elem.value = val;
    return val;
}

async function csa_from_page()
{
    csa.conf.debug_level = Number(document.getElementById('debug_level').value);
    csa.conf.log_max_len = Number(document.getElementById('log_max_len').value);
    csa.conf.write_flash = document.getElementById('write_flash_en').checked;
    csa.conf.big_mtu = document.getElementById('big_mtu_en').checked;
    csa.conf.save_conf = document.getElementById('save_conf_en').checked;
    if (Number(document.getElementById('itvl_min').value) < 6)
        document.getElementById('itvl_min').value = 6;
    if (Number(document.getElementById('itvl_max').value) < Number(document.getElementById('itvl_min').value))
        document.getElementById('itvl_max').value = document.getElementById('itvl_min').value;
    csa.conf.ble_itvl_min = Number(document.getElementById('itvl_min').value);
    csa.conf.ble_itvl_max = Number(document.getElementById('itvl_max').value);
    csa.conf.multi_row = document.getElementById('multi_row_en').checked;
    csa.conf.out_w_mm = num_input('out_w_mm', 1, 10000, 50);
    csa.conf.out_h_mm = num_input('out_h_mm', 1, 10000, 50);
    csa.conf.feather = document.getElementById('feather_en').checked;
    csa.conf.cs = num_input('conv_cs', 0, 400, 100);
    csa.conf.ink = num_input('conv_ink', 1, 400, 100);
    for (let id of ['out_w_mm', 'out_h_mm', 'feather_en'])
        document.getElementById(id).disabled = !csa.conf.multi_row;
    await csa.db.set('var', 'conf', csa.conf);
}

window.input_change = csa_from_page;

// a conversion setting changed: convert the loaded image again
window.conv_change = async function() {
    await csa_from_page();
    if (csa.prj.png_dat)
        await convert_image();
};


function show_conv_info() {
    let elem = document.getElementById('conv_info');
    let dpts = csa.prj.dpts;
    if (!dpts.length) {
        elem.innerText = '';
        return;
    }
    let total = dpts.reduce((n, d) => n + d.length, 0);
    let str = `${dpts.length} row${dpts.length > 1 ? 's' : ''}, ${readable_size(total)}`;
    let info = csa.prj.info;
    if (info && info.out_mm)
        str += `, ${info.out_mm[0].toFixed(1)} x ${info.out_mm[1].toFixed(1)} mm`;
    elem.innerText = str;
}

// convert csa.prj.png_dat with the current settings into csa.prj.dpts;
// a settings change during a conversion queues one more run after it
let conv_busy = false;
let conv_again = false;

async function convert_image() {
    if (conv_busy) {
        conv_again = true;
        return;
    }
    if (!dpc.ready) {
        console.log('Loading, please wait');
        return;
    }
    conv_busy = true;
    try {
        do {
            conv_again = false;
            await convert_once();
        } while (conv_again);
    } finally {
        conv_busy = false;
    }
}

async function convert_once() {
    let opts = {
        div: csa.conv_div, dpi_w: csa.conv_dpi_w,
        cs: csa.conf.cs, ink: csa.conf.ink,
        multi_row: csa.conf.multi_row,
        out_w_mm: csa.conf.out_w_mm, out_h_mm: csa.conf.out_h_mm,
        feather: csa.conf.feather
    };
    console.log(csa.conf.multi_row ?
        `Converting: multi-row, max ${opts.out_w_mm} x ${opts.out_h_mm} mm, feather: ${opts.feather ? 'on' : 'off'}, ` +
        `saturation: ${opts.cs}%, ink: ${opts.ink}%` :
        `Converting: single row, saturation: ${opts.cs}%, ink: ${opts.ink}%`);
    csa.prj.dpts = [];
    csa.prj.info = null;
    show_conv_info();
    let ret = await dpc.conv(csa.prj.png_dat, opts, (p) => {
        console.log(`Conversion: ${p}`);
    });
    if (!ret || !ret.files.length) {
        console.log('No conversion result');
        return;
    }
    csa.prj.dpts = ret.files;
    csa.prj.info = ret.info;
    let total = ret.files.reduce((n, d) => n + d.length, 0);
    console.log(`Conversion output: ${ret.files.length} file(s), ${readable_size(total)} (${total} B)` +
                (ret.info.out_mm ? `, print size: ${ret.info.out_mm[0].toFixed(2)} x ${ret.info.out_mm[1].toFixed(2)} mm` : ''));
    show_conv_info();
    await csa.db.set('var', 'prj', csa.prj);
}


window.addEventListener('load', async function() {
    console.info('Source code and documents of this app: https://github.com/dukelec/mb');
    let prefix = location.pathname.replace(/\//g, "");
    document.getElementById('app_name').innerText = prefix;
    csa.conf = JSON.parse(JSON.stringify(csa.def_conf));
    console.log(`Loading app ${prefix}...`);
    csa.db = await new Idb(`hkp_${prefix}`);
    csa.ble_rx_q = new Queue();
    csa.prj = await csa.db.get('var', 'prj');
    if (!csa.prj) {
        csa.first_install = true;
        csa.prj = JSON.parse(JSON.stringify(csa.def_prj));
        await csa.db.set('var', 'prj', csa.prj);
    }
    // old prj format: a single dpt
    if (!csa.prj.dpts) {
        csa.prj.dpts = csa.prj.dpt ? [csa.prj.dpt] : [];
        csa.prj.info = null;
        delete csa.prj.dpt;
        csa.prj.fmt_ver = csa.def_prj.fmt_ver;
        await csa.db.set('var', 'prj', csa.prj);
    }
    csa.conf = await csa.db.get('var', 'conf');
    if (!csa.conf) {
        csa.conf = JSON.parse(JSON.stringify(csa.def_conf));
        await csa.db.set('var', 'conf', csa.conf);
    }
    for (let k in csa.def_conf) // settings added after the conf was stored
        if (!(k in csa.conf))
            csa.conf[k] = csa.def_conf[k];
    if (csa.prj.png_dat) {
        let blob = new Blob([csa.prj.png_dat], {type: 'image/png'});
        let png_url = URL.createObjectURL(blob);
        let png_file = document.getElementById('img_preview');
        await load_img(png_file, png_url);
        img_preview.style.width = '';
    }
    csa_to_page();
    show_conv_info();
    
    if (prefix == 'hk14') {
        csa.conv_dpi_w = 1237;
        csa.conv_div = 2;
    } else if (prefix == 'mb2') {
        csa.conv_dpi_w = 1200;
        csa.conv_div = 0;
    }
    
    dpc.init(`dpc_${prefix}`);
    init_sw(prefix);
    console.log("App loaded");
});


document.getElementById('open_image').onchange = async function() {
    if (!this.files.length) {
        this.value = '';
        return;
    }
    if (!dpc.ready) {
        console.log('Loading, please wait');
        this.value = '';
        return;
    }
    try {
        let file = this.files[0];
        let img_url = URL.createObjectURL(file);
        let img_preview = document.getElementById('img_preview');
        if (img_preview.src)
            URL.revokeObjectURL(img_preview.src);
        await load_img(img_preview, img_url);
        img_preview.style.width = '';
        if (file.type != 'image/png')
            csa.prj.png_dat = await img2png(img_url);
        else
            csa.prj.png_dat = await read_file(file);
        
        console.log(`PNG file size: ${readable_size(csa.prj.png_dat.length)} (${csa.prj.png_dat.length} B)`);
        await convert_image();
    } catch (err) {
        console.log(`Open image error: ${err}`);
    }
    this.value = '';
};


document.getElementById('open_hex').onchange = async function() {
    if (!this.files.length) {
        this.value = '';
        return;
    }
    try {
        let file = this.files[0];
        let bin = await hex2bin(file);
        console.log(`BIN size: ${readable_size(bin.dat.length)} (${bin.dat.length} B), addr: ${val2hex(bin.addr)}`);
        document.getElementById('hex_file_name').innerText = file.name;
        //download(bin.dat);
        csa.ota_bin = bin.dat;
        document.getElementById('at32_ota_btn').disabled = true;
        document.getElementById('esp32_ota_btn').disabled = true;
        if (bin.addr == 0x08006000)
            document.getElementById('at32_ota_btn').disabled = false;
        else if (bin.addr == 0x00187000)
            document.getElementById('esp32_ota_btn').disabled = false;
        else
            console.log('Invalid start address');
    } catch (err) {
        console.log(`Hex file open error: ${err}`);
    }
    this.value = '';
};


document.getElementById('connect_btn').onclick = async () => {
    await ble_connect();
    if (csa.ble_mosi) {
        document.getElementById('flash_clear_btn').disabled = false;
        await flash_update_info();
    }
};
document.getElementById('disconnect_btn').onclick = ble_disconnect;
document.getElementById('dev_info_btn').onclick = async () => {
    await read_dev_info();
    await flash_update_info();
};
document.getElementById('flash_clear_btn').onclick = async () => {
    if (!confirm('Erase all images stored in the device flash?'))
        return;
    await flash_clear();
};
// store all rows in flash, the device sends them to the printer one after another
async function flash_store_rows(dpts) {
    let info = await flash_update_info();
    if (!info)
        return;
    if (info.files.length) {
        if (!confirm(`The flash holds ${info.files.length} image(s). Erase them and store the ${dpts.length} rows?`))
            return;
        if (await flash_clear(false))
            return;
    }
    for (let i = 0; i < dpts.length; i++) {
        console.log(`Storing row ${i + 1} / ${dpts.length} ...`);
        if (await flash_append(dpts[i], false)) {
            console.log('Storing rows aborted');
            break;
        }
    }
    await flash_reload();
    await flash_update_info();
}

// wait until the printer has printed (state went through printing back to idle), -1 on abort
async function wait_print_done() {
    let printed = false;
    while (true) {
        await sleep(500);
        if (csa.multi_abort || !csa.ble_mosi)
            return -1;
        let ret = await csa_read(R_p_state, 1, false);
        if (!ret || ret[2] !== 0)
            continue;
        let p_state = ret[3];
        if (p_state == 0xff)
            continue;
        if (p_state & 0x4)
            printed = true;
        else if (printed && (p_state & 0x7) == 0)
            return 0;
    }
}

// send the rows to the printer one by one, the next one after the previous one is printed
async function send_rows(dpts) {
    csa.multi_busy = true;
    csa.multi_abort = false;
    let btn = document.getElementById('write_dat_btn');
    btn.innerHTML = '<i class="fa fa-stop"></i> &nbsp; Stop Rows';
    try {
        let info = await flash_update_info();
        if (info && info.files.length)
            console.log(`Note: the device holds ${info.files.length} flash image(s) and sends them to the printer ` +
                        `after each print, clear the flash or set dptz_dis to print rows directly`);
        for (let i = 0; i < dpts.length; i++) {
            console.log(`Sending row ${i + 1} / ${dpts.length} ...`);
            if (await send_dpt(dpts[i]))
                break;
            if (i == dpts.length - 1) {
                console.log('All rows sent, print the last one');
                break;
            }
            console.log(`Row ${i + 1} ready, print it; the next row is sent when it is done`);
            if (await wait_print_done()) {
                console.log('Row sequence stopped');
                break;
            }
        }
    } finally {
        csa.multi_busy = false;
        btn.innerHTML = '<i class="fa fa-print"></i> &nbsp; Transfer Image';
    }
}

document.getElementById('write_dat_btn').onclick = async () => {
    if (csa.multi_busy) {
        csa.multi_abort = true;
        console.log('Stopping the row sequence ...');
        return;
    }
    let dpts = csa.prj.dpts;
    if (!dpts.length) {
        console.log(`No image selected!`);
        return;
    }
    let total = dpts.reduce((n, d) => n + d.length, 0);
    console.log(`Data size: ${readable_size(total)} (${total} B), ${dpts.length} file(s)`);
    if (csa.conf.write_flash) {
        if (dpts.length > 1)
            await flash_store_rows(dpts);
        else
            await flash_append(dpts[0]); // stored in flash, the device sends it to the printer
    } else {
        if (dpts.length > 1)
            await send_rows(dpts);
        else
            await send_dpt(dpts[0]);
    }
};

document.getElementById('at32_ota_btn').onclick = async () => {
    await ota_write(csa.ota_bin, 0x08006000);
};
document.getElementById('esp32_ota_btn').onclick = async () => {
    await ota_write(csa.ota_bin, 0x00187000, false);
};

document.getElementById('set_ble_itvl_btn').onclick = async () => {
    let ret = await csa_write(R_itvl_min, new Uint8Array([csa.conf.ble_itvl_min, csa.conf.ble_itvl_max]), false);
    if (!ret || ret[2] !== 0) {
        console.log('itvl_min/max write error');
        return;
    }
    console.log(`itvl_min/max write succeeded: min: ${csa.conf.ble_itvl_min}, max: ${csa.conf.ble_itvl_max}`);
    if (csa.conf.save_conf) {
        ret = await csa_write(R_save_conf, new Uint8Array([0x01]), false);
        if (!ret || ret[2] !== 0) {
            console.log('Configuration save error');
            return;
        }
        console.log(`Configuration save succeeded`);
    }
};


function init_sw(prefix) {
    console.log('Initializing service worker...');
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(`/${prefix}/sw.js`, {
            scope: `/${prefix}/`
        }).then(function(reg) {
            if (reg.installing) {
                console.log('Service worker is installing');
            } else if (reg.waiting) {
                console.log('Service worker installed');
            } else if (reg.active) {
                console.log('Service worker activated');
            }
        }).catch(function(error) {
            console.log(`Registration failed: ${error}`);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (csa.first_install)
                alert('PWA is now ready to use!');
            else
                alert('App has been updated to the latest version!');
            location.reload();
        });
    }
}
