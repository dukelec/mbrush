/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { konva2d, d2konva } from '../utils/konva_conv.js';
import { konva_zoom, konva_responsive } from '../utils/konva_helper.js';
import { date2num, cpy, download, fetch_timo, upload, obj2blob2u8a } from '../utils/helper.js';
import { mbc } from '../workers/mbc.js';

let stage, layer, layer_bgr, layer_crop;
let conv_busy = false;
let crop_busy = false;


async function save_ui() {
    mb.draft.combine = document.getElementById('combine').checked ? 1 : 0;
    mb.draft.density = Number(document.getElementById('density').value);
    mb.draft.brightness = Number(document.getElementById('brightness').value);
    mb.draft.saturation = Number(document.getElementById('saturation').value);
}

function update_ui() {
    document.getElementById('combine').checked = mb.draft.combine;
    document.getElementById('density').value = mb.draft.density;
    document.getElementById('density_v').innerText = mb.draft.density;
    document.getElementById('brightness').value = mb.draft.brightness;
    document.getElementById('brightness_v').innerText = mb.draft.brightness;
    document.getElementById('saturation').value = mb.draft.saturation;
    document.getElementById('saturation_v').innerText = mb.draft.saturation;
}

function check_value() {
    if (!(mb.draft.density > 0 && mb.draft.density <= 100))
        mb.draft.density = 80;
    if (!(mb.draft.brightness >= 0 && mb.draft.brightness <= 200))
        mb.draft.brightness = 100;
    if (!(mb.draft.saturation >= 0 && mb.draft.saturation <= 500))
        mb.draft.saturation = 100;
}


function new_crop(x, y, w, h) {
    let idx = layer_crop.find('Image').length;
    let img_crop = new Konva.Image({fill: 'white'});
    let rect_crop = new Konva.Rect({
        x: x, y: y, width: w, height: h,
        stroke: 'black',
        strokeWidth: 0.5,
        //shadowBlur: 1,
        dash: [5, 2],
        name: 'crop'
    });
    rect_crop.mb_aux = {idx: idx, img: img_crop};
    
    function rect_text_str() {
        let ratio = 684 / rect_crop.height();
        let l = rect_crop.width() * ratio * 14.2875/684;
        if (mb.conf.show_inch)
            return `#${rect_crop.mb_aux.idx + 1}\n↔ ${(l/25.4).toFixed(2)} inch\n↕ 0.56 inch`;
        else
            return `#${rect_crop.mb_aux.idx + 1}\n↔ ${l.toFixed(2)} mm\n↕ 14.29 mm`;
    }
    
    let text_crop = new Konva.Text({
        x: rect_crop.x() - 18,
        y: rect_crop.y(),
        text: rect_text_str(),
        fontSize: 18,
        fontFamily: 'Calibri',
        fill: 'black',
        align: 'right'
    });
    rect_crop.mb_aux.text = text_crop;
    layer_crop.add(text_crop);
    layer_crop.add(img_crop);
    layer_crop.add(rect_crop);
    
    let update_img_crop = function() {
        let img_obj = layer.toCanvas({
            x: rect_crop.x() * stage.scaleX() + stage.x(),
            y: rect_crop.y() * stage.scaleY() + stage.y(),
            width: rect_crop.width() * stage.scaleX(),
            height: rect_crop.height() * stage.scaleY(),
            pixelRatio: 1 / stage.scaleY()
        });
        img_crop.image(img_obj);
        img_crop.x(rect_crop.x());
        img_crop.y(rect_crop.y());
        text_crop.text(rect_text_str());
        text_crop.x(rect_crop.x() - text_crop.width() - 6);
        text_crop.y(rect_crop.y());
        layer_crop.batchDraw();
    };
    rect_crop.mb_aux.update = update_img_crop;
    update_img_crop();
    layer_crop.batchDraw();
    
    rect_crop.on('dragmove', update_img_crop);
    rect_crop.on('transform', function() {
        rect_crop.width(rect_crop.width() * rect_crop.scaleX());
        rect_crop.height(rect_crop.height() * rect_crop.scaleY());
        rect_crop.scale({ x: 1, y: 1 });
        update_img_crop();
    });
    return rect_crop;
}

function add_crop() {
    if (crop_busy) {
        crop_busy = false;
        stage.off('touchstart mousedown');
        document.getElementById('add_crop_btn').color = undefined;
        return;
    }
    crop_busy = true;
    document.getElementById('add_crop_btn').color = 'warning';
    let start_pos;
    stage.find('Transformer').destroy();
    layer_crop.batchDraw();
    
    stage.on('touchstart mousedown', function(e) {
        //e.evt.cancelBubble = true;
        stage.off('touchstart mousedown');
        start_pos = stage.getPointerPosition();
        let x = (start_pos.x - stage.x()) / stage.scaleX();
        let y = (start_pos.y - stage.y()) / stage.scaleY();
        let rect_crop = new_crop(x, y, 10, 10);
        
        stage.on('touchend mouseup', async function(e) {
            //e.evt.cancelBubble = true;
            stage.off('touchend mouseup');
            stage.off('touchmove mousemove');
            rect_crop.mb_aux.update(); // even click without move
            crop_busy = false;
            stage.off('touchstart mousedown');
            document.getElementById('add_crop_btn').color = undefined;
        });
        
        stage.on('touchmove mousemove', async function(e) {
            e.evt.cancelBubble = true;
            let p = stage.getPointerPosition();
            rect_crop.width(Math.max((p.x - start_pos.x) / stage.scaleX(), 10));
            rect_crop.height(Math.max((p.y - start_pos.y) / stage.scaleY(), 10));
            rect_crop.mb_aux.update();
        });
    });
}

function dump_crop(direction) {
    let tr = stage.find('Transformer');
    if (!tr.length) {
        alert(L('Please select one crop first.'));
        return;
    }
    let ref_crop = tr[0]._node;
    ref_crop.draggable(false);
    tr.destroy();
    if (direction == 'down')
        new_crop(ref_crop.x(), ref_crop.y() + ref_crop.height(), ref_crop.width(), ref_crop.height());
    else
        new_crop(ref_crop.x() + ref_crop.width(), ref_crop.y(), ref_crop.width(), ref_crop.height());
}

function heartbeat_cb() {
    let cur = -1;
    if (mb.dev_info.st == '1')
        cur = Number(mb.dev_info.i);
    for (let i of layer_crop.find('.crop')) {
        if (i.mb_aux.idx == cur) {
            i.stroke('#10dc60');
            i.mb_aux.text.fill('#10dc60');
        } else {
            i.stroke('black');
            i.mb_aux.text.fill('black');
        }
    }
    layer_crop.batchDraw();
}


let page_style = `
.color_ctrl > ion-label {
    text-align: center;
    margin-top: 0px;
    margin-bottom: 0px;
}
.color_ctrl > ion-range {
    padding-top: 0px;
    padding-bottom: 0px;
}`;

let page_style_secret = `
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

async function enter() {
    document.getElementById('app').innerHTML = `
<ion-item>
    <ion-label></ion-label>
    <ion-button id="add_crop_btn">
        <ion-icon name="crop"></ion-icon> ${L('New')}
    </ion-button>
    <ion-button id="dump_crop_down_btn">
        <ion-icon name="copy"></ion-icon> ${L('Dup..')} <ion-icon name="arrow-down"></ion-icon>
    </ion-button>
    <ion-button id="dump_crop_right_btn">
        <ion-icon name="copy"></ion-icon> ${L('Dup..')} <ion-icon name="arrow-forward"></ion-icon>
    </ion-button>
    <ion-button id="del_crop_btn" color="danger">
        <ion-icon name="trash"></ion-icon> ${L('Del')}
    </ion-button>
</ion-item>

<ion-item>
    <ion-label></ion-label>
    <ion-button id="save_btn">
        <ion-icon name="save"></ion-icon> ${L('Save')}
    </ion-button>
    <ion-button onclick="location.hash = '#/edit';">
        <ion-icon name="create"></ion-icon> ${L('Re-Edit')}
    </ion-button>
    <ion-button id="wr2dev_btn">
        <ion-icon name="print"></ion-icon> ${L('Print')}
    </ion-button>
</ion-item>

<ion-item>
    <ion-label>${L('Combine Crops')}</ion-label>
    <ion-checkbox id="combine"></ion-checkbox>
</ion-item>

<ion-item class="color_ctrl" lines="none">
    <ion-label>
        <ion-icon size="small" slot="start" name="color-fill"></ion-icon><br/>
        <small>${L('Density')}</small>
    </ion-label>
    <ion-range id="density" min="1" max="100" color="secondary">
        <ion-label slot="end" id="density_v"></ion-label>
    </ion-range>
</ion-item>
<ion-item class="color_ctrl" lines="none">
    <ion-label>
        <ion-icon size="small" slot="start" name="sunny"></ion-icon><br/>
        <small>${L('Brightness')}</small>
    </ion-label>
    <ion-range id="brightness" min="0" max="200" color="secondary">
        <ion-label slot="end" id="brightness_v"></ion-label>
    </ion-range>
</ion-item>
<ion-item class="color_ctrl">
    <ion-label>
        <ion-icon size="small" slot="start" name="color-palette"></ion-icon><br/>
        <small>${L('Saturation')}</small>
    </ion-label>
    <ion-range id="saturation" min="0" max="500" color="secondary">
        <ion-label slot="end" id="saturation_v"></ion-label>
    </ion-range>
</ion-item>


<ion-card id="konva-parent" mode="md">
    <div id="container"></div>
</ion-card>`;

    document.getElementById('app_style').innerHTML = page_style;
    document.getElementById('nav_title').innerHTML = L('Crop');
    
    if (!mb.draft) {
        location.hash = "#/";
        return;
    }
    
    if (mb.draft.secret) {
        document.getElementById('app_style').innerHTML += page_style_secret;
        document.getElementById('konva-parent').innerHTML = `
            <img src="/img/secret.svg" style="width:100%; height:100%;" />
            <ion-card-content>${mb.cur_prj}</ion-card-content>`;
    }

    let hiden_container = document.createElement('div');
    stage = new Konva.Stage({
        container: mb.draft.secret ? hiden_container : 'container',
        width: 1000,
        height: 1000,
        draggable: true
    });

    layer = new Konva.Layer();
    layer_bgr = new Konva.Layer();
    layer_crop = new Konva.Layer();
    let bgr = new Konva.Rect({
        x: -20,
        y: -20,
        width: stage.width() + 40,
        height: stage.height() + 40,
        fill: 'gray',
        opacity: 0.5,
        listening: false
    });
    layer_bgr.add(bgr);
    stage.add(layer);
    stage.add(layer_bgr);
    stage.add(layer_crop);
    
    await d2konva(layer, mb.draft);
    function save_update_ui() {
        save_ui();
        update_ui();
    };

    check_value();
    update_ui();
    
    document.getElementById('combine').addEventListener('ionChange', save_update_ui);
    document.getElementById('density').addEventListener('ionChange', save_update_ui);
    document.getElementById('brightness').addEventListener('ionChange', save_update_ui);
    document.getElementById('saturation').addEventListener('ionChange', save_update_ui);
    
    for (let name in mb.draft.fonts) {
        let installed = document.fonts.check(`1em '${name}'`);
        if (!installed) {
            const font = new FontFace(name, mb.draft.fonts[name]);
            await font.load();
            document.fonts.add(font);
            layer.batchDraw(); 
            console.log('font install done:', name);
        }
    }
    
    if (mb.draft.crops)
        for (let i of mb.draft.crops)
            new_crop(i.x, i.y, i.w, i.h);
    if (!mb.draft.crops || !mb.draft.crops.length)
        new_crop(100, 50, 200, 50);
    layer.draw();
    layer_bgr.draw();
    layer_crop.draw();
    
    document.getElementById('add_crop_btn').onclick = add_crop;
    document.getElementById('dump_crop_down_btn').onclick = () => {dump_crop('down')};
    document.getElementById('dump_crop_right_btn').onclick = () => {dump_crop('right')};

    konva_zoom(stage);
    konva_responsive(stage, stage.width(), stage.height());
    
    stage.on('click tap', function(e) {
        let tr_old = stage.find('Transformer');
        if (tr_old.length)
            tr_old[0]._node.draggable(false);
        tr_old.destroy();
        layer_crop.draw();

        if (e.target == stage || e.target.parent != layer_crop)
            return;
        if (e.target.getClassName() != 'Rect')
            return;

        var tr = new Konva.Transformer({
            rotateEnabled: false,
            keepRatio: false,
            anchorSize: 20,
            borderEnabled: false,
            centeredScaling: false,
            anchorFill: '#88888880',
            boundBoxFunc: function(oldBoundBox, newBoundBox) {
                if (newBoundBox.width > 10 && newBoundBox.height > 10)
                    return newBoundBox;
                return oldBoundBox;
            }
        });
        layer_crop.add(tr);
        tr.attachTo(e.target);
        e.target.draggable(true);
        layer_crop.draw();
    });
    
    document.getElementById('save_btn').onclick = async function() {
        mb.draft.crops = [];
        for (let i of layer_crop.find('.crop')) {
            let a = {};
            cpy(a, i.attrs, ['x', 'y'], {'width': 'w', 'height': 'h'});
            mb.draft.crops.push(a);
        }
        let thumbnail = stage.toCanvas({
            //x: i.x() * stage.scaleX() + stage.x(),
            //y: i.y() * stage.scaleY() + stage.y(),
            //width: i.width() * stage.scaleX(),
            //height: i.height() * stage.scaleY(),
            pixelRatio: 240 / stage.width()
        });
        mb.draft.thumbnail = await obj2blob2u8a(thumbnail);
        mb.draft.version = 'MBrush v0.0';
        if (!mb.cur_prj) {
            mb.cur_prj = date2num();
            console.log(`save new as: ${mb.cur_prj}`);
        } else {
            console.log(`save update as: ${mb.cur_prj}`);
        }
        await mb.db.set('prj', mb.cur_prj, mb.draft);
        alert(L('Save successed'));
    };
    
    async function do_conv() {
        document.getElementById('nav_sta').innerHTML = L('Start');
        save_ui();
        let ret, cnt = 0;
        let pad_len, pad_begin = false, pad_end = false;
        let pad_px = mb.conf.c_width == 0 ? 134 : 150;
        let offset = 0;
        let crops = layer_crop.find('.crop');
        for (let i of crops) {
            let a = {
                x: i.x() * stage.scaleX() + stage.x(),
                y: i.y() * stage.scaleY() + stage.y(),
                width: i.width() * stage.scaleX(),
                height: i.height() * stage.scaleY(),
                pixelRatio: Math.min(684 / (i.height() * stage.scaleY()), 20)
            };
            let ratio_max = Math.sqrt(1600 * 1600 / (a.width * a.height));
            let ratio_684 = 684 / a.height;
            a.pixelRatio = Math.min(ratio_max, ratio_684);
            console.log(`ratio max: ${ratio_max}, to 684: ${ratio_684}`, a);
            console.log(`size: ${a.width * a.pixelRatio}, ${a.height * a.pixelRatio}`);
            if (mb.draft.combine) {
                pad_len = pad_px * a.height / 684;
                pad_begin = true, pad_end = true;
                if (i == crops[0])
                    pad_begin = false;
                if (i == crops[crops.length-1])
                    pad_end = false;
                if (pad_begin) {
                    a.x -= pad_len;
                    a.width += pad_len;
                }
                if (pad_end) {
                    a.width += pad_len;
                }
                console.log(`pad len ${pad_len}, begin ${pad_begin}, end ${pad_end}`);
            }
            
            let c_obj = layer.toCanvas(a);
            i.mb_aux.png684 = await obj2blob2u8a(c_obj);
            if (!i.mb_aux.png684.length) {
                alert(L('Get crop data error.'));
                return;
            }
            if (!mbc.ready) {
                alert(L('Loading, please try later.'));
                return;
            }
            //download(i.mb_aux.png684, 'test.png'); // debug
            i.mb_aux.mb_dat = await mbc.conv(i.mb_aux.png684, mb.draft.brightness, mb.draft.saturation,
                    Math.round(mb.draft.density * mb.conf.density / 100),
                    {c: mb.conf.cali.c, m: mb.conf.cali.m, y: mb.conf.cali.y},
                    mb.conf.invert, mb.conf.c_order, mb.conf.c_width, mb.conf.dpi_step, (p) => {
                document.getElementById('nav_sta').innerHTML = `${L('Convert')} #${cnt+1}: ${p}`;
            });
            if (!i.mb_aux.mb_dat) {
                console.warn('conv return null');
                return;
            }
            
            if (cnt == 0) {
                ret = await fetch_timo('/cgi-bin/cmd?cmd=rm_upload', {}, 3000);
                if (!ret || ret.status != 'ok') {
                    alert(L('Upload prepare failed.'));
                    return;
                }
            }
            
            let filename, dat;
            if (mb.draft.combine) {
                filename = '0.mbd';
                dat = cnt ? i.mb_aux.mb_dat.slice(16) : i.mb_aux.mb_dat;
                if (pad_begin)
                    dat = dat.slice(Math.trunc(pad_px/mb.conf.dpi_step)*272*1.5);
                if (pad_end)
                    dat = dat.slice(0, dat.length - Math.trunc(pad_px/mb.conf.dpi_step)*272*1.5);
            } else {
                filename = `${cnt}.mbd`;
                dat = i.mb_aux.mb_dat;
                offset = 0;
            }
            console.log(`upload ${filename}, cnt ${cnt}, offset ${offset}`);
            ret = await upload('/cgi-bin/upload', dat, filename, (p) => {
                document.getElementById('nav_sta').innerHTML = `${L('Send')} #${cnt+1}: ${p}`;
            }, offset);
            if (ret)
                return;
            offset += dat.length;
            cnt++;
        }
        ret = await fetch_timo('/cgi-bin/cmd?cmd=sync', {}, 3000);
        if (!ret || ret.status != 'ok') {
            alert(L('Upload done, sync failed.'));
            return;
        }
        document.getElementById('nav_sta').innerHTML = L('Successed');
    };
    document.getElementById('wr2dev_btn').onclick = async function() {
        if (conv_busy) {
            console.log('conv is busy');
            return;
        }
        conv_busy = true;
        try {
            await do_conv();
        } catch (e) {
            console.log('conv catch', e);
        }
        conv_busy = false;
    };
    
    document.getElementById('del_crop_btn').onclick = function() {
        let tr = stage.find('Transformer');
        if (!tr.length)
            return;
        let rect_crop = tr[0]._node;
        let img_crop = rect_crop.mb_aux.img;
        let text_crop = rect_crop.mb_aux.text;
        rect_crop.destroy();
        img_crop.destroy();
        text_crop.destroy();
        tr.destroy();
        let cnt = 0;
        for (let i of layer_crop.find('.crop')) {
            i.mb_aux.idx = cnt++;
            i.mb_aux.update();
        }
        layer_crop.draw();
    };
    document.getElementById('heartbeat_elem').addEventListener('heartbeat', heartbeat_cb);
}

async function leave() {
    document.getElementById('heartbeat_elem').removeEventListener('heartbeat', heartbeat_cb);
}

let Preview = {
    enter: enter,
    leave: leave
}

export { Preview };
