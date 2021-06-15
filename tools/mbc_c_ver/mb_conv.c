/*
 * Copyright (c) 2019, Kudo, Inc.
 * All rights reserved.
 *
 * Author: Duke Fong <d@d-l.io>
 */

#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

static int img_width = -1;

// 4 nozzle groups per colour, there are a total of 684 nozzles, each group has 180 nozzles and only the central 171 are real
// ch_x: [ nozzle group0: [ line0: [ p0, p1 ... p179], line1: [] ... ], nozzle group1: [], nozzle group2: [], nozzle group3: [] ]
static uint8_t *ch_c[4];
static uint8_t *ch_m[4];
static uint8_t *ch_y[4];

// each byte holds 5 nozzles of data, with 3 bits remaining unused
// re_x: [ nozzle group0: [ line0: [ byte0, ... byte35], line1: [] ... ], nozzle group1: [], nozzle group2: [], nozzle group3: [] ]
static uint8_t *re_c[4];
static uint8_t *re_m[4];
static uint8_t *re_y[4];

static const uint8_t order_tb[][9] = {
    {7,5,3,1,8,6,4,2,0},
    {2,0,7,5,3,1,8,6,4},
    {3,1,8,6,4,2,0,7,5}
};

static const int c_shift_md[] = {20, 22, 0, 2};
static const int m_shift_md[] = {58, 56, 78, 76};       //m
static const int y_shift_md[] = {114, 112, 134, 132};   //y
static const int shift_max_md = 134;

static const int c_shift_old[] = {20, 22, 0, 2};
static const int m_shift_old[] = {66, 64, 86, 84};      //m
static const int y_shift_old[] = {130, 128, 150, 148};  //y
static const int shift_max_old = 150;

static int c_shift[4];
static int m_shift[4];
static int y_shift[4];
static int shift_max;

static void reorder(uint8_t *buf, const uint8_t *ch_line, uint8_t order)
{
    const uint8_t *p[20];
    for (int i = 0; i < 20; i ++)
        p[i] = ch_line + i * 9;
    
    for (int n = 0; n < 9; n++) {
        uint8_t i = order_tb[order][n];
        *buf++ = p[0][i] | p[2][i] << 1 | p[4][i] << 2 | p[6][i] << 3 | p[8][i] << 4;
        *buf++ = p[1][i] | p[3][i] << 1 | p[5][i] << 2 | p[7][i] << 3 | p[9][i] << 4;
        *buf++ = p[10][i] | p[12][i] << 1 | p[14][i] << 2 | p[16][i] << 3 | p[18][i] << 4;
        *buf++ = p[11][i] | p[13][i] << 1 | p[15][i] << 2 | p[17][i] << 3 | p[19][i] << 4;
    }
}

static inline void save_1byte(const uint8_t *buf, int l, int i, int shift, uint8_t *f)
{
    if (l < shift || l - shift >= img_width)
        *f = 0;
    else
        *f = *(buf + (l - shift) * 36 + i);
}


int main(int argc, char **argv)
{    
    int invert = argc >= 2 && strcmp(argv[1], "-i1") == 0;
    int is_cym = argc >= 3 && strcmp(argv[2], "-o1") == 0;
    int is_old = argc >= 4 && strcmp(argv[3], "-w1") == 0;
    int dpi_step = 2;
    if (argc >= 5 && strcmp(argv[4], "-s1") == 0)
        dpi_step = 1;
    else if (argc >= 5 && strcmp(argv[4], "-s4") == 0)
        dpi_step = 4;

    struct stat st;
    FILE *rgb_file = fopen("tmp.rgb", "rb");
    fstat(fileno(rgb_file), &st);
    img_width = st.st_size / (3 * 684);
    printf("mbc width: %d\n", img_width);
    
    if (is_old) {
        for (int i = 0; i < 4; i++) {
            c_shift[i] = c_shift_old[i] / dpi_step;
            m_shift[i] = m_shift_old[i] / dpi_step;
            y_shift[i] = y_shift_old[i] / dpi_step;
        }
        shift_max = shift_max_old / dpi_step;
    } else {
        for (int i = 0; i < 4; i++) {
            c_shift[i] = c_shift_md[i] / dpi_step;
            m_shift[i] = m_shift_md[i] / dpi_step;
            y_shift[i] = y_shift_md[i] / dpi_step;
        }
        shift_max = shift_max_md / dpi_step;
    }
    
    for (int i = 0; i < 4; i++) {
        ch_c[i] = calloc(1, img_width * 180);
        ch_m[i] = calloc(1, img_width * 180);
        ch_y[i] = calloc(1, img_width * 180);
        
        re_c[i] = malloc(img_width * 36);
        re_m[i] = malloc(img_width * 36);
        re_y[i] = malloc(img_width * 36);
    }
    
    // splits rgb data to c, m, y channels
    uint8_t rgb_buf[3 * 684];
    for (int l = 0; l < img_width; l++) {
        fread(rgb_buf, 3 * 684, 1, rgb_file);
        uint8_t *buf_p = rgb_buf;
        
        for (int p = 4; p < 180-5; p++) { // ignore the nozzles that are not real
            for (int i = 0; i < 4; i++) {
                // buf pos: rgb_buf + 3 * (p * 4 + i)
                ch_c[i][l * 180 + p] = (*buf_p++) != 0xff;
                if (is_cym) {
                    ch_y[i][l * 180 + p] = (*buf_p++) != 0xff;
                    ch_m[i][l * 180 + p] = (*buf_p++) != 0xff;
                } else {
                    ch_m[i][l * 180 + p] = (*buf_p++) != 0xff;
                    ch_y[i][l * 180 + p] = (*buf_p++) != 0xff;
                }
            }
        }
    }
    
    // the data are arranged in order of ejection, in groups of 5 bits
    for (int i = 0; i < 4; i++) {
        int order_c, order_m, order_y;
        switch (i) {
        case 0: order_c = 0; order_m = 1; order_y = 1; break;
        case 1: order_c = 0; order_m = 2; order_y = 2; break;
        case 2: order_c = 2; order_m = 0; order_y = 0; break;
        case 3: order_c = 1; order_m = 0; order_y = 0; break;
        }
        for (int j = 0; j < img_width; j++) {
            reorder(re_c[i] + 36 * j, ch_c[i] + 180 * j, order_c);
            reorder(re_m[i] + 36 * j, ch_m[i] + 180 * j, order_m);
            reorder(re_y[i] + 36 * j, ch_y[i] + 180 * j, order_y);
        }
    }
    
    fclose(rgb_file);
    for (int i = 0; i < 4; i++) {
        free(ch_c[i]);
        free(ch_m[i]);
        free(ch_y[i]);
    }
    //uint32_t f_size = (img_width + shift_max) * 36 * 12 * 5 / 8;
    uint8_t *out_5b = malloc(36 * 12);
    FILE *f_out = fopen("mb.dat", "wb");
    char header[] = "MBrush\0\0\0\0\0\0\0\0\0";
    header[7] = 0;      // version
    header[8] = invert; // direction: 0 ->, 1 <-
    header[9] = dpi_step;
    fwrite(header, 16, 1, f_out);
    
    for (int l = 0; l < img_width + shift_max; l++) {
        uint8_t *p = out_5b;
        
        // the data is arranged according to the spacing of each nozzle groups to ensure that the printout is colour-aligned
        for (int i = 0; i < 36; i += 2) {
            save_1byte(re_y[0], l, i, y_shift[0], p++);     // a[4:0]
            save_1byte(re_y[3], l, i, y_shift[3], p++);     // b[4:0]
            save_1byte(re_y[0], l, i+1, y_shift[0], p++);   // a[4:0]
            save_1byte(re_y[3], l, i+1, y_shift[3], p++);   // b[4:0]
            save_1byte(re_m[3], l, i, m_shift[3], p++);     // a[4:0]
            save_1byte(re_m[0], l, i, m_shift[0], p++);     // b[4:0]
            save_1byte(re_m[3], l, i+1, m_shift[3], p++);   // a[4:0]
            save_1byte(re_m[0], l, i+1, m_shift[0], p++);   // b[4:0]
            save_1byte(re_c[3], l, i, c_shift[3], p++);     // a[4:0]
            save_1byte(re_c[0], l, i, c_shift[0], p++);     // b[4:0]
            save_1byte(re_c[3], l, i+1, c_shift[3], p++);   // a[4:0]
            save_1byte(re_c[0], l, i+1, c_shift[0], p++);   // b[4:0]
        }
        for (int i = 0; i < 36; i += 2) {
            save_1byte(re_y[1], l, i, y_shift[1], p++);     // a[4:0]
            save_1byte(re_y[2], l, i, y_shift[2], p++);     // b[4:0]
            save_1byte(re_y[1], l, i+1, y_shift[1], p++);   // a[4:0]
            save_1byte(re_y[2], l, i+1, y_shift[2], p++);   // b[4:0]
            save_1byte(re_m[2], l, i, m_shift[2], p++);     // a[4:0]
            save_1byte(re_m[1], l, i, m_shift[1], p++);     // b[4:0]
            save_1byte(re_m[2], l, i+1, m_shift[2], p++);   // a[4:0]
            save_1byte(re_m[1], l, i+1, m_shift[1], p++);   // b[4:0]
            save_1byte(re_c[2], l, i, c_shift[2], p++);     // a[4:0]
            save_1byte(re_c[1], l, i, c_shift[1], p++);     // b[4:0]
            save_1byte(re_c[2], l, i+1, c_shift[2], p++);   // a[4:0]
            save_1byte(re_c[1], l, i+1, c_shift[1], p++);   // b[4:0]
        }
        
        fwrite("\x00\x87", 2, 1, f_out); // add 2 byte gap for fpga spi cmd: write REG_TX
        
        // compress data to save space, using 5 bits per byte to 8 bits per byte
        for (int i = 0; i < 36 * 12; i += 8) {
            uint8_t out[5];
            out[0] = out_5b[i] | out_5b[i+1] << 5;                              // 5+3, left 2b
            out[1] = out_5b[i+1] >> 3  | out_5b[i+2] << 2 | out_5b[i+3] << 7;   // 2+5+1, left 4b
            out[2] = out_5b[i+3] >> 1 | out_5b[i+4] << 4;                       // 4+4, left 1b
            out[3] = out_5b[i+4] >> 4 | out_5b[i+5] << 1 | out_5b[i+6] << 6;    // 1+5+2, left 3b
            out[4] = out_5b[i+6] >> 2 | out_5b[i+7] << 3;                       // 3+5, no left
            fwrite(out, 5, 1, f_out);
        }
    }
    
    free(out_5b);
    for (int i = 0; i < 4; i++) {
        free(re_c[i]);
        free(re_m[i]);
        free(re_y[i]);
    }
    fclose(f_out);
    return 0;
}

