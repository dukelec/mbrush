/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L }        from './utils/lang.js'
import { fetch_timo, date2num } from './utils/helper.js'
import { Idb }      from './utils/idb.js';
import { Home }     from './pages/home.js'
import { Edit }     from './pages/edit.js'
import { Preview }  from './pages/preview.js'
import { Setting }  from './pages/setting.js'

//Konva.pixelRatio = 1;

let app_ver = "_APPVER_";
let first_install = false;

window.mb = {
    app_ver: app_ver,
    db: null,
    cur_prj: null,
    cur_tpl: null,
    draft: null,
    dev_info: null,
    conf: null,
    sys_font: ['serif', 'sans-serif', 'monospace'],
    def_conf: {
        mb_app_ver: app_ver,
        density: 80,
        cali: {c:255, m:255, y:255},
        invert: 0,
        c_order: 0, // 0: cmy, 1: cym
        c_width: 0, // 0: new, 1: old
        dpi_step: 2, // 1200 x (1200 / 1, 2, 4)
        show_inch: 0,
        strength: 20,
        pos_cali: 0,
        space: -20,
        buzzer: 1
    },
    dev_info: {}
};

const routes = {
    '/'             : Home,
    '/edit'         : Edit,
    '/preview'      : Preview,
    '/setting'      : Setting
};

let pre = null;

const router = async () => {
    dismiss_modal();
    document.querySelector('ion-menu-controller').close();
    if (pre && pre.leave)
        await pre.leave();
    document.getElementById('app_style').innerHTML = '';
    let url = location.hash.slice(1).split('?')[0] || '/';
    console.log('router:', url);
    let page = routes[url];
    await page.enter();
    pre = page;
    document.getElementById('app').scrollToTop();
}

window.addEventListener('hashchange', router);
window.addEventListener('load', async function() {
    console.info('source code and documents of this app:\n\thttps://github.com/dukelec/mb');
    console.log("load app");
    mb.db = await new Idb();
    mb.conf = await mb.db.get('var', 'conf');
    if (!mb.conf) {
        first_install = true;
        mb.conf = JSON.parse(JSON.stringify(mb.def_conf));
        await mb.db.set('var', 'conf', mb.conf);
        
        let response = await fetch('/demo/demo.mbp');
        let data = await response.arrayBuffer();
        let prj = msgpack.decode(new Uint8Array(data));
        if (!prj || !prj.version || !prj.version.startsWith('MBrush v0.')) {
            console.log('import demo.mbp failed');
        } else {
            await mb.db.set('prj', date2num(), prj);
        }
    }
    router();
    init_sw();
});


let last_bat_img = 'img/offline.svg';
let offline_img = null;

fetch('img/offline.svg').then(function(response) {
    return response.blob();
}).then(function(myBlob) {
    offline_img = URL.createObjectURL(myBlob);
});

async function dev_get_info() {
    let bat_img_src;
    let ret = await fetch_timo('/cgi-bin/cmd?cmd=get_info', {}, 2000);
    if (ret && ret.info.startsWith("mb: ")) {
        let info = JSON.parse('{"' + ret.info.replace(/: /g, '": "').replace(/, /g, '", "') + '"}');
        mb.dev_info = info;
        let voltage = Number(info.bat);
        if (voltage >= 75)
            bat_img_src = "img/bat_4.svg";
        else if (voltage >= 50)
            bat_img_src = "img/bat_3.svg";
        else if (voltage >= 25)
            bat_img_src = "img/bat_2.svg";
        else
            bat_img_src = "img/bat_1.svg";
        
        let event = new Event('heartbeat');
        document.getElementById('heartbeat_elem').dispatchEvent(event);
    } else {
        bat_img_src = "img/offline.svg";
    }
    
    if (last_bat_img != bat_img_src) {
        console.log(`dev state: ${last_bat_img} -> ${bat_img_src}`);
        if (bat_img_src == "img/offline.svg")
            document.getElementById('nav_con').src = offline_img;
        else
            document.getElementById('nav_con').src = bat_img_src;
        last_bat_img = bat_img_src;
    }
}
dev_get_info();
setInterval(dev_get_info, 2000);

function init_sw() {
    console.log('init_sw...');
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        }).then(function(reg) {
            if (reg.installing) {
                console.log('Service worker installing');
            } else if (reg.waiting) {
                console.log('Service worker installed');
            } else if (reg.active) {
                console.log('Service worker active');
            }
        }).catch(function(error) {
            console.log('Registration failed with ' + error);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!first_install) {
                alert(L('Switching APP to new version.'));
                location.reload();
            }
        });
    }
}

// for ionic modal
window.dismiss_modal = async function() {
    const modal = document.querySelector('ion-modal');
    if (modal)
        await modal.dismiss({'dismissed': true});
};

document.getElementById('index_menu').innerText =  L('Menu');
document.getElementById('index_home').innerText =  L('Home');
document.getElementById('index_setting').innerText =  L('Setting');
