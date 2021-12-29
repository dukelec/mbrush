C version of mbc converter
======

## Build
```
mbc_c_ver $ gcc -o mbc mb_conv.c
```

## Prepare the rgb data

```
convert ori.png -fill white -resize 50x100% -modulate 100 -modulate 100,100 \
  -colorize 40 -geometry x684 -bordercolor none -alpha remove \
  -dither FloydSteinberg -remap map.bmp -rotate 90 tmp.rgb  # or tmp.bmp for debug
```

```
brightness:
    -modulate xxx       # 0~100

saturation:
    -modulate 100,xxx   # 0~100

density_n:
    -colorize xxx       # 1~100

dpi_step:
    1: -resize 100x100%
    2: -resize 50x100%
    4: -resize 25x100%
```

## Convert

```
mbc_c_ver $ ls -l tmp.rgb
mbc_c_ver $ ./mbc
```

