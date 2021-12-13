/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { read_file, fetch_timo, upload } from '../utils/helper.js'

let wifi_conf = {
    ssid: '',
    passwd: ''
};
let block_ui_event = false;

async function save_conf() {
    mb.conf.mb_app_ver = mb.app_ver;
    mb.conf.density = Number(document.getElementById('density').value);
    mb.conf.cali = {
        c: Number(document.getElementById('c_cali').value),
        m: Number(document.getElementById('m_cali').value),
        y: Number(document.getElementById('y_cali').value)
    };
    mb.conf.invert = document.getElementById('invert_en').value == '1' ? 1 : 0;
    mb.conf.c_order = document.getElementById('c_order').value == '1' ? 1 : 0;
    mb.conf.c_width = document.getElementById('c_width').value == '1' ? 1 : 0;
    mb.conf.show_inch = document.getElementById('show_inch_en').value == '1' ? 1 : 0;
    mb.conf.show_grid = document.getElementById('show_grid_en').checked ? 1 : 0;
    mb.conf.strength = Number(document.getElementById('strength').value);
    mb.conf.pos_cali = Number(document.getElementById('pos_cali').value);
    mb.conf.space = -Number(document.getElementById('space_n').value);
    mb.conf.dpi_step = Number(document.getElementById('dpi_step').value);
    mb.conf.buzzer = document.getElementById('buzzer_en').checked ? 1 : 0;
    
    wifi_conf.ssid = document.getElementById('wifi_ssid').value;
    wifi_conf.passwd = document.getElementById('wifi_passwd').value;
    wifi_conf.freq = document.getElementById('wifi_freq').value;
}

function update_ui() {
    block_ui_event = true;
    document.getElementById('density').value = mb.conf.density;
    document.getElementById('density_v').innerText = mb.conf.density;
    document.getElementById('c_cali').value = mb.conf.cali.c;
    document.getElementById('m_cali').value = mb.conf.cali.m;
    document.getElementById('y_cali').value = mb.conf.cali.y;
    document.getElementById('c_cali_v').innerText = mb.conf.cali.c;
    document.getElementById('m_cali_v').innerText = mb.conf.cali.m;
    document.getElementById('y_cali_v').innerText = mb.conf.cali.y;
    document.getElementById('invert_en').value = mb.conf.invert;
    document.getElementById('c_order').value = mb.conf.c_order;
    document.getElementById('c_width').value = mb.conf.c_width;
    document.getElementById('show_inch_en').value = mb.conf.show_inch;
    document.getElementById('show_grid_en').checked = mb.conf.show_grid;
    document.getElementById('strength').value = mb.conf.strength;
    document.getElementById('strength_v').innerText = mb.conf.strength;
    document.getElementById('pos_cali').value = mb.conf.pos_cali;
    document.getElementById('pos_cali_v').innerText = mb.conf.pos_cali;
    document.getElementById('space_n').value = -mb.conf.space;
    document.getElementById('space_n_v').innerText = -mb.conf.space;
    document.getElementById('dpi_step').value = String(mb.conf.dpi_step);
    document.getElementById('buzzer_en').checked = mb.conf.buzzer;
    
    document.getElementById('wifi_ssid').value = wifi_conf.ssid;
    document.getElementById('wifi_passwd').value = wifi_conf.passwd;
    document.getElementById('wifi_freq').value = wifi_conf.freq;
    block_ui_event = false;
}


async function conf_from_dev() {
    let ret = await fetch_timo('/cgi-bin/cmd?cmd=get_app_conf', {}, 3000);
    if (ret && ret.app_conf) {
        let conf = JSON.parse('{"' + ret.app_conf.replace(/=/g, '": "').replace(/&/g, '", "') + '"}');
        mb.conf.density = Number(conf.density);
        mb.conf.cali = {
            c: Number(conf.c_cali),
            m: Number(conf.m_cali),
            y: Number(conf.y_cali)
        };
        mb.conf.invert = Number(conf.invert);
        mb.conf.c_order = Number(conf.c_order);
        mb.conf.c_width = Number(conf.c_width);
        mb.conf.dpi_step = Number(conf.dpi_step);
    } else {
        alert(L('Read app_conf from device error'));
        return;
    }
    update_ui();
    
    ret = await fetch_timo('/cgi-bin/cmd?cmd=get_conf', {}, 3000);
    if (ret && ret.conf) {
        let conf = JSON.parse('{"' + ret.conf.replace(/=/g, '": "').replace(/&/g, '", "') + '"}');
        mb.conf.space = Number(conf.space);
        mb.conf.pos_cali = Number(conf.pos_cali);
        mb.conf.buzzer = Number(conf.buzzer);
        mb.conf.strength = Number(conf.strength);
    } else {
        alert(L('Read conf from device error'));
        return;
    }
    update_ui();
}

async function conf_to_dev() {
    save_conf();
    
    let val = `space=${mb.conf.space}&pos_cali=${mb.conf.pos_cali}`;
    val += `&buzzer=${mb.conf.buzzer}&strength=${mb.conf.strength}`;
    
    let val_app = `density=${mb.conf.density}&c_cali=${mb.conf.cali.c}&m_cali=${mb.conf.cali.m}&y_cali=${mb.conf.cali.y}`;
    val_app += `&invert=${mb.conf.invert}&c_order=${mb.conf.c_order}&c_width=${mb.conf.c_width}&dpi_step=${mb.conf.dpi_step}`;
    
    let ret = await fetch_timo('/cgi-bin/cmd?cmd=set_conf', {
      method: 'POST',
      body: `conf=${encodeURIComponent(val)}`
    }, 3000);
    
    if (!ret || ret.status != "ok") {
        alert(L('Write conf to device error'));
        return;
    }
    
    ret = await fetch_timo('/cgi-bin/cmd?cmd=set_app_conf', {
      method: 'POST',
      body: `app_conf=${encodeURIComponent(val_app)}`
    }, 3000);
    
    if (!ret || ret.status != "ok") {
        alert(L('Write app_conf to device error'));
        return;
    }
    
    alert(L('Write to device succeeded'));
}


async function wifi_from_dev() {
    let ret = await fetch_timo('/cgi-bin/cmd?cmd=get_wifi', {}, 3000);
    if (ret && ret.wifi) {
        let conf = JSON.parse('{"' + ret.wifi.replace(/=/g, '": "').replace(/&/g, '", "') + '"}');
        wifi_conf.ssid = decodeURIComponent(conf.ssid);
        wifi_conf.passwd = decodeURIComponent(conf.passwd);
        wifi_conf.freq = conf.freq;
    } else {
        alert(L('Read wifi conf from device error'));
        return;
    }
    update_ui();
}

async function wifi_to_dev() {
    save_conf();
    if (!wifi_conf.ssid.length) {
        alert(L('SSID is empty!'));
        return;
    }
    if (wifi_conf.passwd.length < 8) {
        alert(L('Passwd at least 8 char!'));
        return;
    }
    if (!wifi_conf.freq)
        wifi_conf.freq = 2462;
    
    let val = `ssid=${encodeURIComponent(wifi_conf.ssid)}&passwd=${encodeURIComponent(wifi_conf.passwd)}&freq=${wifi_conf.freq}`;
    console.log(val);
    
    let ret = await fetch_timo('/cgi-bin/cmd?cmd=set_wifi', {
      method: 'POST',
      body: `wifi=${encodeURIComponent(val)}`
    }, 3000);
    
    if (!ret || ret.status != "ok") {
        alert(L('Write wifi conf to device error'));
        return;
    }
    
    await fetch_timo('/cgi-bin/cmd?cmd=reboot', {}, 3000);
    alert(L('Write to device succeeded, reboot...'));
}

function heartbeat_cb() {
    document.getElementById('dev_info_v').innerText = mb.dev_info.v;
    document.getElementById('dev_info_mb').innerText = mb.dev_info.mb;
    document.getElementById('dev_info_iqc').innerText = mb.dev_info.iqc;
}


let Setting = {
    enter: async () => {
        document.getElementById('app').innerHTML = `

<ion-list>
    <ion-list-header>
        ${L('Theme')} & DPI
    </ion-list-header>
    <ion-item>
        <ion-label><small>${L('Dark Theme')}</small></ion-label>
        <ion-button onclick="ToggleTheme()">
            </ion-icon> ${L('Toggle Theme')}
        </ion-button>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Density')} & DPI
    </ion-list-header>
    
    <ion-item>
        <ion-label><small>${L('Global Density').replace(' ', '<br>')}</small></ion-label>
        <ion-range id="density" min="1" max="100">
            <ion-label slot="end" id="density_v"></ion-label>
        </ion-range>
    </ion-item>
    <ion-item>
        <ion-label><small>DPI</small></ion-label>
        <ion-select value="1" id="dpi_step">
            <ion-select-option value="1">1200 x 1200 dpi</ion-select-option>
            <ion-select-option value="2">1200 x 600 dpi</ion-select-option>
            <ion-select-option value="4">1200 x 300 dpi</ion-select-option>
        </ion-select>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Direction')}
    </ion-list-header>
    <ion-item>
        <ion-segment id="invert_en">
            <ion-segment-button value="1">
                <ion-icon name="arrow-back"></ion-icon>
            </ion-segment-button>
            <ion-segment-button value="0">
                <ion-icon name="arrow-forward"></ion-icon>
            </ion-segment-button>
        </ion-segment>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Display Unit')}
    </ion-list-header>
    <ion-item>
        <ion-segment id="show_inch_en">
            <ion-segment-button value="0">
                <ion-label>mm</ion-label>
            </ion-segment-button>
            <ion-segment-button value="1">
                <ion-label>inch</ion-label>
            </ion-segment-button>
        </ion-segment>
    </ion-item>
    <ion-item>
        <ion-label><small>${L('Display Grid')}</small></ion-label>
        <ion-toggle slot="end" id="show_grid_en" value="pepperoni" checked></ion-toggle>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Cartridge Type')}
    </ion-list-header>
    <ion-item>
        <ion-segment id="c_order">
            <ion-segment-button value="0">
                <ion-label>${L('CMY')}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="1">
                <ion-label>${L('CYM')}</ion-label>
            </ion-segment-button>
        </ion-segment>
    </ion-item>
    <ion-item>
        <ion-segment id="c_width">
            <ion-segment-button value="0">
                <ion-label>4.4mm</ion-label>
            </ion-segment-button>
            <ion-segment-button value="1">
                <ion-label>4.9mm</ion-label>
            </ion-segment-button>
        </ion-segment>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Color Calibration')}
    </ion-list-header>
    <ion-item>
        <ion-label>${L('Cyan')}</ion-label>
        <ion-range id="c_cali" min="1" max="255" color="primary">
            <ion-label slot="end" id="c_cali_v"></ion-label>
        </ion-range>
    </ion-item>
    <ion-item>
        <ion-label>${L('Magenta')}</ion-label>
        <ion-range id="m_cali" min="1" max="255" color="danger">
            <ion-label slot="end" id="m_cali_v"></ion-label>
        </ion-range>
    </ion-item>
    <ion-item>
        <ion-label>${L('Yellow')}</ion-label>
        <ion-range id="y_cali" min="1" max="255" color="warning">
            <ion-label slot="end" id="y_cali_v"></ion-label>
        </ion-range>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Device Setting')}
    </ion-list-header>
    <ion-item>
        <ion-label><small>${L('Drive Strength').replace(' ', '<br>')}</small></ion-label>
        <ion-range id="strength" min="0" max="30" value="20">
            <ion-label slot="end" id="strength_v"></ion-label>
        </ion-range>
    </ion-item>
    <ion-item>
        <ion-label><small>${L('Color Alignment').replace(' ', '<br>')}</small></ion-label>
        <ion-range id="pos_cali" min="-40" max="40" value="0">
            <ion-label slot="end" id="pos_cali_v"></ion-label>
        </ion-range>
    </ion-item>
    <ion-item>
        <ion-label><small>${L('Leading Space').replace(' ', '<br>')}</small></ion-label>
        <ion-range id="space_n" min="0" max="800" value="20">
            <ion-label slot="end" id="space_n_v"></ion-label>
        </ion-range>
    </ion-item>
    <ion-item>
        <ion-label><small>${L('Buzzer')}</small></ion-label>
        <ion-toggle slot="end" id="buzzer_en" value="pepperoni" checked></ion-toggle>
    </ion-item>
    
    <ion-item>
        <ion-label></ion-label>
        <ion-button id="conf_rst_btn">
            <ion-icon name="refresh"></ion-icon> ${L('Default')}
        </ion-button>
        <ion-button id="conf_r_dev_btn">
            <ion-icon name="arrow-up"></ion-icon> ${L('Read Dev')}
        </ion-button>
        <ion-button id="conf_w_dev_btn">
            <ion-icon name="arrow-down"></ion-icon> ${L('Write Dev')}
        </ion-button>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        Wi-Fi ${L('Configuration')}
    </ion-list-header>
    <ion-item>
        <ion-input placeholder="${L('SSID')}" id="wifi_ssid"></ion-input>
    </ion-item>
    <ion-item>
        <ion-input placeholder="${L('Password')}" id="wifi_passwd"></ion-input>
    </ion-item>
    <ion-item>
        <ion-label>${L('Channel')}</ion-label>
        <ion-select id="wifi_freq">
            <ion-select-option value="2412">1</ion-select-option>
            <ion-select-option value="2417">2</ion-select-option>
            <ion-select-option value="2422">3</ion-select-option>
            <ion-select-option value="2427">4</ion-select-option>
            <ion-select-option value="2432">5</ion-select-option>
            <ion-select-option value="2437">6</ion-select-option>
            <ion-select-option value="2442">7</ion-select-option>
            <ion-select-option value="2447">8</ion-select-option>
            <ion-select-option value="2452">9</ion-select-option>
            <ion-select-option value="2457">10</ion-select-option>
            <ion-select-option value="2462">11</ion-select-option>
            <!--ion-select-option value="2467">12 (${L('Not allowed in the US')})</ion-select-option-->
            <!--ion-select-option value="2472">13 (${L('Not allowed in the US')})</ion-select-option-->
            <!--ion-select-option value="2484">14 (${L('Japan only')})</ion-select-option-->
        </ion-select>
    </ion-item>
    
    <ion-item>
        <ion-label></ion-label>
        <ion-button id="wifi_r_dev_btn">
            <ion-icon name="arrow-up"></ion-icon> ${L('Read Dev')}
        </ion-button>
        <ion-button id="wifi_w_dev_btn">
            <ion-icon name="arrow-down"></ion-icon> ${L('Write Dev')}
        </ion-button>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Device Info')}
    </ion-list-header>
    
    <ion-item>
        <ion-label>${L('APP Version')}</ion-label> <span>${mb.app_ver}<span>
    </ion-item>
    <ion-item>
        <ion-label>${L('FW Version')}</ion-label> <span id="dev_info_v">${mb.dev_info.v}<span>
    </ion-item>
    <ion-item>
        <ion-label>${L('DEV ID')}</ion-label> <span id="dev_info_mb">${mb.dev_info.mb}</span>
    </ion-item>
    <ion-item>
        <ion-label>${L('Sensor IQC')}</ion-label> <span id="dev_info_iqc">${mb.dev_info.iqc}</span>
    </ion-item>
    <ion-item>
        <ion-label>HTTPS ${L('Certificate')}</ion-label> <a href="/mb_ca.pem" download>mb_ca.pem</a>
    </ion-item>
    <ion-item style="display: ${location.protocol != 'https:' ? 'inline' : 'none'};">
        <ion-label>HTTPS ${L('Link')}</ion-label> <a href="https://${location.host}">https://${location.host}</a>
    </ion-item>
</ion-list>

<ion-list>
    <ion-list-header>
        ${L('Firmware Update')}
    </ion-list-header>
    <ion-item>
        <ion-label>${L('Last Firmware')}</ion-label> <a href="https://github.com/dukelec/mb/releases" target="_blank">${L('Link')}</a>
    </ion-item>
    <ion-item>
        <input type="file" id="input_fw" accept=".tar" class="float-left">
    </ion-item>
    <ion-item>
        <ion-label></ion-label>
        <ion-button onclick="location.reload()">
            <ion-icon name="refresh"></ion-icon> ${L('Refresh App')}
        </ion-button>
        <ion-button id="fw_upload_btn">
            <ion-icon name="arrow-down"></ion-icon> ${L('Write Dev')}
        </ion-button>
    </ion-item>
</ion-list>`;

        document.getElementById('nav_title').innerHTML = L('Setting');
        
        document.getElementById('conf_rst_btn').onclick = async () => {
            mb.conf = JSON.parse(JSON.stringify(mb.def_conf));
            update_ui();
            await mb.db.set('var', 'conf', mb.conf);
        };
        document.getElementById('conf_r_dev_btn').onclick = conf_from_dev;
        document.getElementById('conf_w_dev_btn').onclick = conf_to_dev;
        document.getElementById('wifi_r_dev_btn').onclick = wifi_from_dev;
        document.getElementById('wifi_w_dev_btn').onclick = wifi_to_dev;
        
        
        async function save_update_ui() {
            if (block_ui_event)
                return;
            save_conf();
            update_ui();
            await mb.db.set('var', 'conf', mb.conf);
        };
        update_ui();
        document.getElementById('density').addEventListener('ionChange', save_update_ui);
        document.getElementById('c_cali').addEventListener('ionChange', save_update_ui);
        document.getElementById('m_cali').addEventListener('ionChange', save_update_ui);
        document.getElementById('y_cali').addEventListener('ionChange', save_update_ui);
        document.getElementById('invert_en').addEventListener('ionChange', save_update_ui);
        document.getElementById('c_order').addEventListener('ionChange', save_update_ui);
        document.getElementById('c_width').addEventListener('ionChange', save_update_ui);
        document.getElementById('show_inch_en').addEventListener('ionChange', save_update_ui);
        document.getElementById('show_grid_en').addEventListener('ionChange', save_update_ui);
        document.getElementById('strength').addEventListener('ionChange', save_update_ui);
        document.getElementById('pos_cali').addEventListener('ionChange', save_update_ui);
        document.getElementById('space_n').addEventListener('ionChange', save_update_ui);
        document.getElementById('dpi_step').addEventListener('ionChange', save_update_ui);
        document.getElementById('buzzer_en').addEventListener('ionChange', save_update_ui);
        document.getElementById('wifi_freq').addEventListener('ionChange', save_update_ui);
        
        document.getElementById('fw_upload_btn').onclick = async () => {
            let input = document.getElementById('input_fw');
            if (!input.files || !input.files.length) {
                alert(L('Please select file first'));
                return;
            }
            
            let file = input.files[0];
            let data = await read_file(file);
            
            document.getElementById('fw_upload_btn').disabled = true;
            await upload('/cgi-bin/upload', data, 'mbrush-fw.tar', (p) => {
                document.getElementById('nav_sta').innerHTML = `${L('Upload')}: ${p}`;
            });
            
            let ret = await fetch_timo('/cgi-bin/cmd?cmd=upgrade', {}, 3000);
            if (ret && ret.status == 'ok')
                alert(L('Upgrade succeeded, reboot...'));
            else
                alert(`${L('Upgrade failed')}: ${ret.status}`);
        };
        
        document.getElementById('heartbeat_elem').addEventListener('heartbeat', heartbeat_cb);
    },
    
    leave: async () => {
        document.getElementById('heartbeat_elem').removeEventListener('heartbeat', heartbeat_cb);
    }
}

export { Setting };
