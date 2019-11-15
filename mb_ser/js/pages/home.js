/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { konva2d, d2konva } from '../utils/konva_conv.js';
import { cpy, read_file, date2num, download } from '../utils/helper.js';

async function init_projects() {
    document.getElementById('projects').innerHTML = '';
    let prj_keys = await mb.db.keys('prj');
    for (let k of prj_keys) {
        let prj = await mb.db.get('prj', k);
        let img_blob = new Blob([prj.thumbnail], {type: 'image/png'});
        let src = URL.createObjectURL(img_blob);
        let html;
        if (!prj.secret) {
            html = `
                <ion-card>
                    <img src="${src}" id="prj_${k}" style="width:100%; height:100%;" />
                    <ion-card-content>${k}</ion-card-content>
                </ion-card>`;
        } else {
            html = `
                <ion-card>
                    <img src="/img/secret.svg" id="prj_${k}" style="width:100%; height:100%;" />
                    <ion-card-content>${k}</ion-card-content>
                </ion-card>`;
        }
        document.getElementById('projects').insertAdjacentHTML('beforeend', html);
        document.getElementById('prj_' + k).onclick = async function() {
            mb.cur_prj = k;
            mb.cur_tpl = null;
            mb.draft = null;
            await present_action();
        };
    }
}

async function present_action() {

    const actionSheet = document.createElement('ion-action-sheet');

    actionSheet.header = `${mb.cur_prj}`;
    actionSheet.mode = 'ios';
    actionSheet.buttons = [{
        text: L('Print'),
        icon: 'print',
        handler: async () => {
            mb.draft = await mb.db.get('prj', mb.cur_prj);
            location.hash = "#/preview";
        }
    }, {
        text: L('Edit'),
        icon: 'create',
        handler: async () => {
            mb.draft = await mb.db.get('prj', mb.cur_prj);
            location.hash = "#/edit";
        }
    }, {
        text: L('Duplicate'),
        icon: 'copy',
        handler: async () => {
            let cur = await mb.db.get('prj', mb.cur_prj);
            let new_k = date2num();
            await mb.db.set('prj', new_k, cur);
            await init_projects();
        }
    }, {
        text: L('Export'),
        icon: 'share',
        handler: async () => {
            let cur = await mb.db.get('prj', mb.cur_prj);
            if (cur.secret == true) {
                let alert = document.createElement('ion-alert');
                alert.header = L('Alert');
                alert.message = L("Can't export secret project as normal.");
                alert.buttons = [L('OK')];
                document.body.appendChild(alert);
                alert.present();
                return;
            }
            cur.secret = false;
            const dat = msgpack.encode(cur);
            download(dat, `${mb.cur_prj}.mbp`);
        }
    }, {
        text: L('Export (Secret)'),
        icon: 'share',
        handler: async () => {
            let cur = await mb.db.get('prj', mb.cur_prj);
            cur.secret = true;
            const dat = msgpack.encode(cur);
            download(dat, `${mb.cur_prj}.mbp`);
        }
    }, {
        text: L('Delete'),
        role: 'destructive',
        icon: 'trash',
        handler: async () => {
            await mb.db.del('prj', mb.cur_prj);
            mb.cur_prj = null;
            await init_projects();
        }
    }, {
        text: L('Cancel'),
        icon: 'close',
        role: 'cancel',
        //handler: () => {}
    }];
    document.body.appendChild(actionSheet);
    return actionSheet.present();
}


let page_style = `
#projects {
    width: 100%;
}
ion-card {
    display: inline-block !important;
    width: 160px;
    max-width: 46%;
    margin: 2px !important;
    vertical-align: top !important;
    text-align: center;
}
ion-card-content {
    padding-left: 10px !important;
    padding-right: 10px !important;
    padding-top: 5px !important;
    padding-bottom: 5px !important;
}`;

let Home = {
    enter: async () => {
        document.getElementById('app').innerHTML = `
<ion-item lines="none">
    <ion-label></ion-label>
    <ion-button color="secondary" id="prj_import_btn">
        <ion-icon name="folder-open"></ion-icon> ${L('Open')}
    </ion-button>
    &nbsp;
    <ion-button id="prj_new_btn">
        <ion-icon name="add"></ion-icon> ${L('New')}
    </ion-button>
</ion-item>

<ion-item lines="none">
    <ion-text id="projects">
    </ion-text>
</ion-item>

<ion-action-sheet-controller></ion-action-sheet-controller>
<input id="input_file" type="file" style="display:none;">`;
        
        document.getElementById('app_style').innerHTML = page_style;
        document.getElementById('nav_title').innerHTML = L('Projects');
        await init_projects();
        
        document.getElementById("prj_new_btn").onclick = async function() {
            mb.cur_prj = null;
            mb.draft = { 'files': {}, 'sub': [], 'fonts': [] };
            location.hash = "#/edit";
        };
        
        document.getElementById("prj_import_btn").onclick = async function() {
            //let input = document.createElement('input');
            //cpy(input, {type: 'file', accept: '*.mbp'}, ['type', 'accept']);
            let input = document.getElementById('input_file');
            input.accept = '.mbp';
            input.onchange = async function () {
                var files = this.files;
                if (files && files.length) {
                
                    let file = files[0];
                    let data = await read_file(file);
                    let prj = msgpack.decode(data);
                    if (!prj || !prj.version || !prj.version.startsWith('MBrush v0.')) {
                        alert(L('Format error'));
                        return;
                    }
                    await mb.db.set('prj', date2num(), prj);
                    await init_projects();
                    alert(L('Import successed'));
                }
            };
            input.click();
        };
    }
}

export { Home };
