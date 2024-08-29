/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { L } from '../utils/lang.js'
import { load_img, cpy, obj2blob2u8a, date2num } from '../utils/helper.js';
import { konva_update, konva2d, d2konva } from '../utils/konva_conv.js';
import { konva_zoom, konva_responsive } from '../utils/konva_helper.js';

let stage;
let layer;
let cur_obj = null;
let cur_obj_t = null;
let update_timer;

function tr_attach(obj) {
    var tr = new Konva.Transformer({
        //rotateEnabled: false,
        //keepRatio: false,
        anchorSize: 20,
        //borderEnabled: false,
        centeredScaling: false,
        anchorFill: '#88888880',
        boundBoxFunc: function(oldBoundBox, newBoundBox) {
            let use_old = false;
            if (newBoundBox.width >= 0 && newBoundBox.width < 10) {
                oldBoundBox.width = 10;
                use_old = true;
            }
            if (newBoundBox.width < 0 && newBoundBox.width > -10) {
                oldBoundBox.width = -10;
                use_old = true;
            }
            if (newBoundBox.height >= 0 && newBoundBox.height < 10) {
                oldBoundBox.height = 10;
                use_old = true;
            }
            if (newBoundBox.height < 0 && newBoundBox.height > -10) {
                oldBoundBox.height = -10;
                use_old = true;
            }
            return use_old ? oldBoundBox : newBoundBox;
        }
    });
    layer.add(tr);
    tr.nodes([obj]);
}

async function install_fonts() {
    let ret_val = 0;
    for (let name in mb.draft.fonts) {
        // Workaround: Do not check if it is already installed, as the check always returns true for Safari.
        //let installed = document.fonts.check(`1em '${name}'`);
        //if (!installed) {
            try {
                const font = new FontFace(name, mb.draft.fonts[name]);
                await font.load();
                document.fonts.add(font);
                layer.batchDraw();
                console.log('font install done:', name);
            } catch {
                console.error('font install failed:', name);
                ret_val--;
            }
        //}
    }
    return ret_val;
}

function text_modal_update_style() {
    let font_sel = document.getElementById('font_sel');
    let font_sel2 = document.getElementById('font_sel2');
    let shadow_en_e = document.getElementById('shadow_en');
    let shadow_x_e = document.getElementById('shadow_x');
    let shadow_y_e = document.getElementById('shadow_y');
    let shadow_blur_e = document.getElementById('shadow_blur');
    let shadow_opacity_e = document.getElementById('shadow_opacity');
    let shadow_color_e = document.getElementById('shadow_color');
    
    document.getElementById('txt_val').style.textAlign = document.getElementById('txt_align_sel').value;
    if (document.getElementById('font_style').value == 'bold') {
        document.getElementById('txt_val').style.fontStyle = '';
        document.getElementById('txt_val').style.fontWeight = 'bold';
    } else if (document.getElementById('font_style').value == 'italic') {
        document.getElementById('txt_val').style.fontStyle = 'italic';
        document.getElementById('txt_val').style.fontWeight = '';
    } else {
        document.getElementById('txt_val').style.fontStyle = '';
        document.getElementById('txt_val').style.fontWeight = '';
    }
    document.getElementById('txt_val').style.color = document.getElementById('txt_color').value;
    
    let num = Number(document.getElementById('font_size').value);
    document.getElementById('txt_val').style.fontSize = `${num}em`;
    if (font_sel.value == font_sel2.value) {
        document.getElementById('txt_val').style.fontFamily =`'${font_sel.value}'`;
    } else {
        document.getElementById('txt_val').style.fontFamily = `'${font_sel.value}', '${font_sel2.value}'`;
    }
    
    if (!shadow_en_e.checked) {
        //document.getElementById('txt_val').style.textShadow = '';
        document.getElementById('app_style').innerHTML = page_style;
        return;
    }
    let opacity = ("0"+(Number(shadow_opacity_e.value).toString(16))).slice(-2).toUpperCase();
    //document.getElementById('txt_val').style.textShadow =
    document.getElementById('app_style').innerHTML = page_style + `
        textarea {
            text-shadow: ${shadow_x_e.value}px ${shadow_y_e.value}px ${shadow_blur_e.value}px ${shadow_color_e.value}${opacity};
        }`;
    console.log('set shadow:', `${shadow_x_e.value}px ${shadow_y_e.value}px ${shadow_blur_e.value}px ${shadow_color_e.value}${opacity}`);
}

function text_modal_edit_init(obj) {
    if (obj.getClassName() == 'Text') {
        let font = obj.fontFamily();
        if (Array.isArray(font)) {
            document.getElementById('font_sel').value = font[0];
            document.getElementById('font_sel2').value = font[1];
        } else {
            document.getElementById('font_sel').value = font;
            document.getElementById('font_sel2').value = font;
        }
        document.getElementById('font_size').value = Number(obj.fontSize()) / 32;
        document.getElementById('font_style').value = obj.fontStyle();
        document.getElementById('txt_align_sel').value = obj.align();
    }
    if (obj.shadowColor()) {
        document.getElementById('shadow_en').checked = true;
        document.getElementById('shadow_x').value = obj.shadowOffsetX();
        document.getElementById('shadow_y').value = obj.shadowOffsetY();
        document.getElementById('shadow_blur').value = obj.shadowBlur();
        document.getElementById('shadow_opacity').value = obj.shadowOpacity() * 255;
        document.getElementById('shadow_color').value = obj.shadowColor();
    } else {
        document.getElementById('shadow_en').checked = false;
    }
    document.getElementById('txt_color').value = obj.getClassName() == 'Text' ? obj.fill() : obj.attrs.qr_color;
    document.getElementById('txt_val').value = obj.attrs.text_src;
    text_modal_update_style();
}

function text_modal_init() {
    if (cur_obj_t != 'Text') {
        for (let e of document.getElementsByClassName("text_only"))
            e.hidden = true;
    }
    if (cur_obj_t == 'Image') {
        for (let e of document.getElementsByClassName("text_qr_only"))
            e.hidden = true;
    }
    
    let font_sel = document.getElementById('font_sel');
    let font_sel2 = document.getElementById('font_sel2');
    let shadow_en_e = document.getElementById('shadow_en');
    let shadow_x_e = document.getElementById('shadow_x');
    let shadow_y_e = document.getElementById('shadow_y');
    let shadow_blur_e = document.getElementById('shadow_blur');
    let shadow_opacity_e = document.getElementById('shadow_opacity');
    let shadow_color_e = document.getElementById('shadow_color');
    
    font_sel.innerHTML = '';
    font_sel2.innerHTML = '';
    for (let name of mb.sys_font) {
        font_sel.insertAdjacentHTML('beforeend', `<option value="${name}">${name}</option>`);
        font_sel2.insertAdjacentHTML('beforeend', `<option value="${name}">${name}</option>`);
    }
    
    for (let name in mb.draft.fonts) {
        let html_sel = `<option value="${name}" style="font-family: '${name}'">${name}</option>`;
        font_sel.insertAdjacentHTML('beforeend', html_sel);
        font_sel2.insertAdjacentHTML('beforeend', html_sel);
    }
    
    document.getElementById('txt_align_sel').onchange =
        document.getElementById('font_style').onchange =
        document.getElementById('txt_color').onchange =
        document.getElementById('font_size').onchange =
        font_sel2.onchange = font_sel.onchange =
        shadow_x_e.onchange = shadow_y_e.onchange = shadow_blur_e.onchange =
        shadow_color_e.onchange = text_modal_update_style;
    shadow_en_e.addEventListener('ionChange', text_modal_update_style);
    shadow_opacity_e.addEventListener('ionChange', text_modal_update_style);

    document.getElementById('txt_modal_save').onclick = async function () {
        dismiss_modal();
        let txt_e = document.getElementById('txt_val');
        if ((cur_obj_t == 'Text' || cur_obj_t == 'QR Code') && !txt_e.value.length)
            return;
        let a = {
            'text':  Function("return `" + txt_e.value + "`;")(),
            'fill': document.getElementById('txt_color').value,
            'fontFamily': font_sel.value == font_sel2.value ? font_sel.value : [font_sel.value, font_sel2.value],
            'fontSize': 32 * Number(document.getElementById('font_size').value),
            'align': document.getElementById('txt_align_sel').value,
            'fontStyle': document.getElementById('font_style').value,
            'x': 120,
            'y': 50
        };
        if (shadow_en_e.checked) {
            a.shadowColor = shadow_color_e.value;
            a.shadowBlur = Number(shadow_blur_e.value);
            a.shadowOpacity = Number(shadow_opacity_e.value)/255;
            a.shadowOffsetX = Number(shadow_x_e.value);
            a.shadowOffsetY = Number(shadow_y_e.value);
        }
        let img = null;
        if ((cur_obj_t == 'Image' && txt_e.value != '') || cur_obj_t == 'QR Code') {
            let qrcode = new QRCode({
                content: a.text,
                padding: 1,
                width: 256,
                height: 256,
                color: a.fill,
                background: "#ffffff",
                ecl: "M"
            });
            let svg = qrcode.svg();
            const svg_blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svg_blob);
            img = new Image();
            let ret = await load_img(img, url);
            console.log('svg url:', url);
        }
        if (cur_obj) {
            if (cur_obj_t == 'Text') {
                cur_obj.attrs.text_src = txt_e.value;
                cur_obj.text(a.text);
                cur_obj.fontFamily(a.fontFamily);
                cur_obj.fontSize(a.fontSize);
                cur_obj.align(a.align);
                cur_obj.fontStyle(a.fontStyle);
                cur_obj.fill(a.fill);
            } else if (img) {
                cur_obj.attrs.text_src = txt_e.value;
                cur_obj.attrs.qr_color = a.fill;
                cur_obj.image(img);
            }
            cur_obj.shadowColor(shadow_en_e.checked ? a.shadowColor : null);
            cur_obj.shadowBlur(shadow_en_e.checked ? a.shadowBlur : null);
            cur_obj.shadowOpacity(shadow_en_e.checked ? a.shadowOpacity : null);
            cur_obj.shadowOffsetX(shadow_en_e.checked ? a.shadowOffsetX : null);
            cur_obj.shadowOffsetY(shadow_en_e.checked ? a.shadowOffsetY : null);
        } else {
            let new_obj = null;
            if (cur_obj_t == 'Text') {
                new_obj = new Konva.Text(a);
            } else {
                new_obj = new Konva.Image({image: img, x: 50, y: 50});
                new_obj.attrs.qr_color = a.fill;
            }
            new_obj.attrs.text_src = txt_e.value;
            layer.add(new_obj);
        }
        layer.draw();
        cur_obj = null;
        console.log('insert obj');
    };
    
    if (cur_obj)
        text_modal_edit_init(cur_obj);
}

let page_style = `
.opacity_ctrl > ion-label {
    text-align: center;
    margin-top: 2px;
    margin-bottom: 2px;
}
.opacity_ctrl > ion-range {
    padding-top: 2px;
    padding-bottom: 2px;
}
#txt_val {
    font-family: serif;
}`;

customElements.define('modal-fonts', class extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
<ion-header>
    <ion-toolbar>
        <ion-title>${L('User Fonts')}</ion-title>
        <ion-buttons slot="primary">
            <ion-button onClick="dismiss_modal();">
                <ion-icon slot="icon-only" name="close"></ion-icon>
            </ion-button>
        </ion-buttons>
    </ion-toolbar>
</ion-header>
<ion-content class="ion-padding">
    <ion-item>
        <ion-label></ion-label>
        <ion-button id="add_font_btn">
            <ion-icon name="folder-open"></ion-icon> ${L('Add Font')}
        </ion-button>
    </ion-item>
    <ion-list class="list-group" id="user_font_list">
    </ion-list>
</ion-content>`;
        function load_font_list() {
            let list = document.getElementById('user_font_list');
            list.innerHTML = '';
            for (let name in mb.draft.fonts) {
                let html = `
                    <ion-item>
                        <ion-label style="font-family: '${name}'">${name}</ion-label>
                        <ion-button id="add_font_btn" color="danger">
                            <ion-icon name="trash"></ion-icon>
                        </ion-button>
                    </ion-item>`;
                list.insertAdjacentHTML('beforeend', html);
                list.lastElementChild.getElementsByTagName("ion-button")[0].onclick = function() {
                    delete mb.draft.fonts[name];
                    load_font_list();
                };
            }
        }
        load_font_list();
        
        document.getElementById('add_font_btn').onclick = () => {
            //let input = document.createElement('input');
            //cpy(input, {type: 'file'}, ['type']);
            let input = document.getElementById('input_file');
            input.accept = null;
            input.onchange = function () {
                if (!this.files.length)
                    return;
                var file = this.files[0];
                var name = file.name.replace(/\.[^/.]+$/, "");
                if (/^\d/.test(name)) // startswith number
                    name = '_' + name;
                if (name) {
                    var reader = new FileReader();
                    reader.onload = async function() {
                        mb.draft.fonts[name] = new Uint8Array(reader.result);
                        console.log('font add done:', name);
                        let ret = await install_fonts();
                        if (ret < 0) {
                            delete mb.draft.fonts[name];
                            alert(L('Invalid font file!'));
                        }
                        load_font_list();
                        //document.getElementById('txt_val').style=`font-family: '${name}', 'NSimSun';`;
                    }
                    reader.readAsArrayBuffer(file);
                }
            };
            input.click();
        };
    }
});

customElements.define('modal-text', class extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
<ion-header>
    <ion-toolbar>
        <ion-title>${L('Add')} ${L(cur_obj_t)}</ion-title>
        <ion-buttons slot="primary">
            <ion-button onClick="dismiss_modal();">
                <ion-icon slot="icon-only" name="close"></ion-icon>
            </ion-button>
        </ion-buttons>
    </ion-toolbar>
</ion-header>
<ion-content class="ion-padding">

    <ion-item class="text_only">
        <ion-grid>
            <ion-row>
                <ion-col>
                    <ion-label>${L('Font')}</ion-label>
                    <select id="font_sel">
                      <!--option value="xx">XX</option-->
                    </select>
                </ion-col>
                <ion-col>
                    <ion-label>${L('Fallback Font')}</ion-label>
                    <select id="font_sel2">
                      <!--option value="xx">XX</option-->
                    </select>
                </ion-col>
            </ion-row>
        </ion-grid>
    </ion-item>
    
    <ion-item class="text_qr_only">
    <ion-grid>
        <ion-row>
            <ion-col class="text_only">
                <ion-label>${L('Size')}</ion-label>
                <select id="font_size">
                    <option value="1">x1</option>
                    <option value="1.5">x1.5</option>
                    <option value="2">x2</option>
                </select>
            </ion-col>
            <ion-col class="text_only">
                <ion-label>${L('Style')}</ion-label>
                <select id="font_style">
                    <option value="normal">${L('Normal')}</option>
                    <option value="bold">${L('Bold')}</option>
                    <option value="italic">${L('Italic')}</option>
                </select>
            </ion-col>
            <ion-col class="text_only">
                <ion-label>${L('Align')}</ion-label>
                <select id="txt_align_sel">
                    <option value="left">${L('Left')}</option>
                    <option value="center">${L('Center')}</option>
                    <option value="right">${L('Right')}</option>
                </select>
            </ion-col>
            <ion-col>
                <ion-label>${L('Color')}</ion-label>
                <input type="color" id="txt_color" value="#000000">
            </ion-col>
        </ion-row>
    </ion-grid>
    </ion-item>

    <ion-item>
        <ion-grid>
            <ion-row>
                <ion-col>
                    <ion-label>${L('Shadow')}</ion-label>
                    <ion-checkbox id="shadow_en"></ion-checkbox>
                </ion-col>
                <ion-col>
                    <ion-label>X</ion-label>
                    <ion-input type="number" id="shadow_x" value="2" min="-200", max="200"></ion-input>
                </ion-col>
                <ion-col>
                    <ion-label>Y</ion-label>
                    <ion-input type="number" id="shadow_y" value="2" min="-200", max="200"></ion-input>
                </ion-col>
                <ion-col>
                    <ion-label>${L('Blur')}</ion-label>
                    <ion-input type="number" id="shadow_blur" value="5" min="0", max="200"></ion-input>
                </ion-col>
                <ion-col>
                    <ion-label>${L('Color')}</ion-label>
                    <input type="color" id="shadow_color" value="#ff0000">
                </ion-col>
            </ion-row>
        </ion-grid>
    </ion-item>

    <ion-item class="opacity_ctrl">
        <ion-label>
            <ion-icon size="small" slot="start" name="color-fill"></ion-icon><br/>
            <small>${L('Opacity')}</small>
        </ion-label>
        <ion-range id="shadow_opacity" min="1" max="255" value="255" color="secondary">
            <ion-label slot="end" id="shadow_opacity_v">100</ion-label>
        </ion-range>
    </ion-item>

    <ion-item class="text_qr_only">
        <ion-textarea rows="6" id="txt_val" placeholder="${L('Enter text here...')}"></ion-textarea>
    </ion-item>

    <ion-item lines="none">
        <ion-label></ion-label>
        <ion-button id="txt_modal_save">
            <ion-icon name="folder-open"></ion-icon> ${L('Save')}
        </ion-button>
    </ion-item>

</ion-content>`;

        text_modal_init();
    }
});

async function enter() {
    document.getElementById('app').innerHTML = `
<ion-item>
    <ion-label></ion-label>
    <ion-button id="add_img_btn">
        <ion-icon name="images"></ion-icon> ${L('Add Image')}
    </ion-button>
    <ion-button id="add_txt_btn">
        <ion-icon name="chatbox-ellipses-outline"></ion-icon> ${L('Add Text')}
    </ion-button>
    <ion-button id="add_qr_btn">
        <ion-icon name="qr-code-outline"></ion-icon> ${L('QR Code')}
    </ion-button>
    <ion-button id="user_font_btn">
        <strong>F</strong> &nbsp; ${L('User Fonts')}
    </ion-button>
</ion-item>
<ion-item>
    <ion-label></ion-label>
    <ion-button id="dup_btn">
        <ion-icon name="copy"></ion-icon> ${L('Duplicate')}
    </ion-button>
    <ion-button id="rst_ratio_btn">
        <ion-icon name="refresh"></ion-icon> ${L('Ratio 1:1')}
    </ion-button>
    <ion-button id="del_btn" color="danger">
        <ion-icon name="trash"></ion-icon> ${L('Delete Item')}
    </ion-button>
</ion-item>
<ion-item>
    <ion-label></ion-label>
    <ion-button id="mv_up_btn">
        <ion-icon name="arrow-up"></ion-icon> ${L('Move up')}
    </ion-button>
    <ion-button id="mv_down_btn">
        <ion-icon name="arrow-down"></ion-icon> ${L('Down')}
    </ion-button>
    <ion-button id="mv_top_btn">
        <ion-icon name="arrow-up-circle"></ion-icon> ${L('Top')}
    </ion-button>
    <ion-button id="mv_bottom_btn">
        <ion-icon name="arrow-down-circle"></ion-icon> ${L('Bottom')}
    </ion-button>
</ion-item>
<ion-item>
    <ion-label></ion-label>
    <ion-button id="group_btn">
        <ion-icon name="people"></ion-icon> ${L('Group')}
    </ion-button>
    <ion-button id="ungroup_btn">
        <ion-icon name="person"></ion-icon> ${L('Ungroup')}
    </ion-button>
</ion-item>
<ion-item>
    <ion-label></ion-label>
    <ion-button id="save_prj_btn">
        <ion-icon name="save"></ion-icon> ${L('Save')}
    </ion-button>
    <ion-button id="preview_btn">
        <ion-icon name="print"></ion-icon> ${L('Print Preview')}
    </ion-button>
</ion-item>

<ion-item class="opacity_ctrl">
    <ion-label>
        <ion-icon size="small" slot="start" name="color-fill"></ion-icon><br/>
        <small>${L('Opacity')}</small>
    </ion-label>
    <ion-range id="opacity" min="1" max="100" value="100" color="secondary">
        <ion-label slot="end" id="opacity_v">100</ion-label>
    </ion-range>
</ion-item>

<ion-card id="konva-parent" mode="md">
    <div id="container"></div>
</ion-card>

<input id="input_file" type="file" style="display:none;">`;
    
    document.getElementById('app_style').innerHTML = page_style;
    document.getElementById('nav_title').innerHTML = L('Edit');
    if (!mb.draft || mb.draft.secret) {
        location.hash = "#/";
        return;
    }
    
    stage = new Konva.Stage({
        container: 'container',
        width: 1000,
        height: 1000,
        draggable: true
    });
    
    var layer_bg = new Konva.Layer();
    let bgr = new Konva.Rect({
        x: 0,
        y: 0,
        width: stage.width(),
        height: stage.height(),
        stroke: 'black',
        strokeWidth: 1,
        shadowBlur: 1,
        opacity: 0.8,
        dash: [6, 3],
        listening: false
    });
    layer_bg.add(bgr);
    stage.add(layer_bg);
    layer_bg.draw();

    layer = new Konva.Layer();
    stage.add(layer);
    await d2konva(layer, mb.draft);
    layer.draw();
    
    konva_zoom(stage);
    konva_responsive(stage, stage.width(), stage.height());
    await install_fonts();
    
    
    document.getElementById('opacity').addEventListener('ionChange', function() {
        let opacity = Number(document.getElementById('opacity').value);
        document.getElementById('opacity_v').innerText = opacity;
        
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        let node = trs[0]._nodes[0];
        node.opacity(opacity / 100);
        layer.batchDraw();
        console.log("set node opacity", opacity, node);
    });
    
    // preview & save
    
    document.getElementById('preview_btn').onclick = async () => {
        let d = await konva2d(layer);
        cpy(mb.draft, d, ['files', 'sub']);
        location.hash = "#/preview";
    };
    
    document.getElementById('save_prj_btn').onclick = async () => {
        let d = await konva2d(layer);
        cpy(mb.draft, d, ['files', 'sub']);
        let thumbnail = stage.toCanvas({ pixelRatio: 240 / stage.width() });
        mb.draft.thumbnail = await obj2blob2u8a(thumbnail);
        mb.draft.version = 'MBrush v0.0';
        if (!mb.cur_prj) {
            mb.cur_prj = date2num();
            console.log(`save new as: ${mb.cur_prj}`);
        } else {
            console.log(`save update as: ${mb.cur_prj}`);
        }
        await mb.db.set('prj', mb.cur_prj, mb.draft);
        alert(L('Save succeeded'));
    };
    
    // group & ungroup
    
    stage.on('click tap', function(e) {
        let trs_old = stage.find('Transformer');

        if (e.target == stage) {
            for (let t of trs_old)
                t._nodes[0].draggable(false);
            trs_old.destroy();
            layer.draw();
            return;
        }
        
        let obj = e.target;
        while (obj.parent != layer)
            obj = obj.parent;
        
        if (obj.getClassName() == "Transformer")
            return;
        
        for (let t of trs_old) {
            if (obj == t._nodes[0]) {
                if (obj.getClassName() == 'Text' || obj.getClassName() == 'Image')
                    text_re_edit(obj);
                return;
            }
        }
        
        tr_attach(obj);
        obj.draggable(true);
        layer.batchDraw();
        
        if (obj.opacity() > 0 && obj.opacity() <= 1) {
            document.getElementById('opacity').value = obj.opacity() * 100;
            document.getElementById('opacity_v').innerText = obj.opacity() * 100;
        } else {
            document.getElementById('opacity').value = '100';
            document.getElementById('opacity_v').innerText = '100';
        }
    });
    
    document.getElementById('group_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length < 2) {
            alert(L('At least select two items'));
            return;
        }
        let x = trs[0]._nodes[0].x();
        let y = trs[0]._nodes[0].y();
        let group = new Konva.Group({
            x: x,
            y: y,
            draggable: true
        });
        trs.sort((a, b) => a._nodes[0].zIndex() - b._nodes[0].zIndex());
        for (let t of trs) {
            t._nodes[0].draggable(false);
            t._nodes[0].moveTo(group);
            t._nodes[0].x(t._nodes[0].x() - x);
            t._nodes[0].y(t._nodes[0].y() - y);
        }
        trs.destroy();
        layer.add(group);
        tr_attach(group);
        layer.batchDraw();
    };
    
    document.getElementById('ungroup_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1 || trs[0]._nodes[0].getClassName() != 'Group') {
            alert(L('Not a group'));
            return;
        }
        let group = trs[0]._nodes[0];
        let cs = [...group.children];
        for (let c of cs) {
            c.moveTo(group.parent);
            c.x(c.x() + group.x());
            c.y(c.y() + group.y());
            c.draggable(true);
            tr_attach(c);
        }
        group.destroy();
        trs.destroy();
        layer.batchDraw();
    };
    
    // add image & text
    
    document.getElementById('add_img_btn').onclick = () => {
        //let input = document.createElement('input');
        //cpy(input, {type: 'file', accept: 'image/*'}, ['type', 'accept']);
        let input = document.getElementById('input_file');
        input.accept = 'image/*';
        input.onchange = async function () {
            var files = this.files;
            console.log("import img, click:", files);
            if (files && files.length) {
                let src = URL.createObjectURL(files[0]);
                let img = new Image();
                let ret = await load_img(img, src);
                let p = new Konva.Image({image: img, x: 50, y: 50});
                if (p.width() > stage.width() || p.height() > stage.height()) {
                    let ratio = Math.min(stage.width()/p.width(), stage.height()/p.height());
                    p.scaleX(ratio);
                    p.scaleY(ratio);
                    console.log(`import img: resize img, ratio: ${ratio}`);
                }
                layer.add(p);
                layer.draw();
            }
        };
        input.click();
    };
    
    document.getElementById("add_txt_btn").onclick = async function() {
        cur_obj = null;
        cur_obj_t = 'Text';
        const modalElement = document.createElement('ion-modal');
        modalElement.component = 'modal-text';
        document.body.appendChild(modalElement);
        return modalElement.present();
    };
    
    document.getElementById("add_qr_btn").onclick = async function() {
        cur_obj = null;
        cur_obj_t = 'QR Code';
        const modalElement = document.createElement('ion-modal');
        modalElement.component = 'modal-text';
        document.body.appendChild(modalElement);
        return modalElement.present();
    };
    
    function text_re_edit(obj) {
        cur_obj = obj;
        cur_obj_t = obj.getClassName();
        if (obj.attrs.text_src && obj.attrs.text_src != '' && cur_obj_t == 'Image')
            cur_obj_t = 'QR Code';
        const modalElement = document.createElement('ion-modal');
        modalElement.component = 'modal-text';
        document.body.appendChild(modalElement);
        modalElement.present();
    }
    
    // fonts
    
    document.getElementById("user_font_btn").onclick = async function() {
        const modalElement = document.createElement('ion-modal');
        modalElement.component = 'modal-fonts';
        document.body.appendChild(modalElement);
        return modalElement.present();
    };
    
    // delete
    
    document.getElementById('del_btn').onclick = () => {
        let trs = stage.find('Transformer');
        for (let t of trs)
            t._nodes[0].destroy();
        trs.destroy();
        layer.draw();
    };
    
    // duplicate
    
    document.getElementById('dup_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        let ref = trs[0]._nodes[0];
        let clone = ref.clone();
        clone.x(ref.x() + 40);
        clone.y(ref.y() + 40);
        trs.destroy();
        layer.add(clone);
        layer.draw();
    };
    
    // change z
    
    document.getElementById('mv_up_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        trs[0]._nodes[0].moveUp();
        layer.draw();
    }
    document.getElementById('mv_down_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        trs[0]._nodes[0].moveDown();
        layer.draw();
    }
    document.getElementById('mv_top_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        trs[0]._nodes[0].moveToTop();
        layer.draw();
    }
    document.getElementById('mv_bottom_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        trs[0]._nodes[0].moveToBottom();
        layer.draw();
    }
    
    // reset ratio
    
    document.getElementById('rst_ratio_btn').onclick = () => {
        let trs = stage.find('Transformer');
        if (trs.length != 1)
            return;
        let node = trs[0]._nodes[0];
        let ratio = (node.scaleX() + node.scaleY()) / 2;
        node.scaleX(ratio);
        node.scaleY(ratio);
        layer.draw();
    }
    
    update_timer = setInterval(async () => { await konva_update(layer); layer.draw(); }, 1000);
}

let Edit = {
    enter: enter,
    leave: () => { clearInterval(update_timer); }
}

export { Edit };
