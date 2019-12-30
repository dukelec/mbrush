#!/bin/bash

brand="$1"
[ "$brand" == "" ] && brand="PrinCube"

rm -rf mbrush-fw/*
mkdir -p mbrush-fw

cp -r ../mb_etc ../mb_conf ../mb_ser mbrush-fw/
cp ota_pre/* mbrush-fw/

if [ "$1" != "PC" ]; then
    mv mbrush-fw/mb_ser/cgi-bin/cmd.mips mbrush-fw/mb_ser/cgi-bin/cmd
    mv mbrush-fw/mb_ser/cgi-bin/upload.mips mbrush-fw/mb_ser/cgi-bin/upload
else
    rm mbrush-fw/mb_ser/cgi-bin/cmd.mips mbrush-fw/mb_ser/cgi-bin/upload.mips
    mkdir -p mbrush-fw/mb_ser/doc
    echo "RewriteEngine On" > mbrush-fw/mb_ser/doc/.htaccess
    echo "RewriteRule ^/?(.*) https://github.com/dukelec/mb [R,L]" >> mbrush-fw/mb_ser/doc/.htaccess
fi

find mbrush-fw/ -type d -name ".git" | xargs rm -rf

version="$(cat ../mb_ser/version)"
version_app="${version%%_*}"

echo "version: $version, APP: $version_app"
find mbrush-fw/ -type f -name "*.js" -exec sed -i "s/_APPVER_/$version_app/g" '{}' \;
rm -rf mbrush-fw/mb_ser/upload/*
mv mbrush-fw/mb_ser/demo/demo.mbd mbrush-fw/mb_ser/upload/0.mbd

if [ "$brand" == "Princube" ]; then
    echo "brand: $brand"
    tar cf $brand-fw-$version.tar mbrush-fw/
elif [ "$brand" == "PC" ]; then
    echo "brand: PrinCube simulate"
    rm mbrush-fw/uImage mbrush-fw/run.sh
    tar cf princube-sim-$version.tar mbrush-fw/
else
    echo "brand: $brand"
    find mbrush-fw/ -type f \( -name "*.json" -o -name "*.html" -o -name "*.conf" -o -name "S80mb" \) \
                    -exec sed -i "s/PrinCube/$brand/g" '{}' \;
    tar cf $brand-fw-$version.tar mbrush-fw/
fi

rm -rf mbrush-fw/

