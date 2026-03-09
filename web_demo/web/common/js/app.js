/*
 * Copyright (c) 2019, Dukelec, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { Idb } from './utils/idb.js';
import { Queue, read_file, val2hex, load_img, img2png, hex2bin, download, crc16, readable_size, dat_append } from './utils/helper.js';
import { send_command, csa_write, csa_read, ble_connect, ble_disconnect, read_dev_info } from './ble_common.js';
import { send_dpt } from './send_dpt.js';
import { ota_write } from './ota.js';
import { dpc } from './workers/dpc.js';

const R_save_conf = 0x0007;
const R_itvl_min = 0x00a6;


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
        fmt_ver: '1.0',
        png_dat: null,
        dpt: null
    },
    prj: null,
    
    def_conf: {
        fmt_ver: '1.0',
        debug_level: 1,
        log_max_len: 5000,
        write_flash: false,
        big_mtu: false,
        save_conf: false,
        ble_itvl_min: 6,
        ble_itvl_max: 12
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
    await csa.db.set('var', 'conf', csa.conf);
}

window.input_change = csa_from_page;


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
    csa.conf = await csa.db.get('var', 'conf');
    if (!csa.conf) {
        csa.conf = JSON.parse(JSON.stringify(csa.def_conf));
        await csa.db.set('var', 'conf', csa.conf);
    }
    if (csa.prj.png_dat) {
        let blob = new Blob([csa.prj.png_dat], {type: 'image/png'});
        let png_url = URL.createObjectURL(blob);
        let png_file = document.getElementById('img_preview');
        await load_img(png_file, png_url);
        img_preview.style.width = '';
    }
    csa_to_page();
    
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
        
        csa.prj.dpt = await dpc.conv(csa.prj.png_dat, csa.conv_div, csa.conv_dpi_w, (p) => {
            console.log(`Conversion: ${p}`);
        });
        if (!csa.prj.dpt) {
            console.log('No conversion result');
            return;
        }
        console.log(`Conversion output: ${readable_size(csa.prj.dpt.length)} (${csa.prj.dpt.length} B)`);
        await csa.db.set('var', 'prj', csa.prj);
    } catch {
        console.log('Open image error');
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


document.getElementById('connect_btn').onclick = ble_connect;
document.getElementById('disconnect_btn').onclick = ble_disconnect;
document.getElementById('dev_info_btn').onclick = read_dev_info;
document.getElementById('write_dat_btn').onclick = async () => {
    if (!csa.prj.dpt) {
        console.log(`No image selected!`);
        return;
    }
    console.log(`Data size: ${readable_size(csa.prj.dpt.length)} (${csa.prj.dpt.length} B)`);
    if (!csa.conf.write_flash) {
        await send_dpt(csa.prj.dpt);
        return;
    }
    let crc = crc16(csa.prj.dpt);
    let hdr = new Uint8Array([0, 0, 0, 0]);
    let dv = new DataView(hdr.buffer);
    dv.setUint32(0, csa.prj.dpt.length, true);
    let crc_dat = new Uint8Array([crc & 0xff, crc >> 8]);
    const bin = dat_append(dat_append(hdr, csa.prj.dpt), crc_dat);
    await ota_write(bin, 0x00187000, false);
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
