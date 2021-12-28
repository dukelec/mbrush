#!/bin/bash
cd "$(dirname "$0")"

brand="$1"
if [ "$brand" == "" ]; then
    echo "Usage: $0 [BRAND-NAME]"
    echo "For PC simulation: $0 PC"
    echo "(Please remember to update version string in mb_ser/version first)"
    exit -1
fi

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
mv mbrush-fw/mb_ser/demo/*.mbd mbrush-fw/mb_ser/upload/

if [ "$brand" == "PC" ]; then
    echo "brand: PC simulation"
    rm mbrush-fw/uImage mbrush-fw/run.sh
    outfile="pc-sim-$version.tar"
else
    echo "brand: $brand"
    find mbrush-fw/ -type f \( -name "*.json" -o -name "*.html" -o -name "*.conf" -o -name "S80mb" \) \
                    -exec sed -i "s/_BRAND_/$brand/g" '{}' \;
    outfile="$brand-fw-$version.tar"
fi

echo "computing hash values ..."
./_gen_sw.sh > hashlist.txt
sed -i "/_HASHLIST_/ r hashlist.txt" mbrush-fw/mb_ser/sw.js
rm -f hashlist.txt

echo "compressing files with gzip ..."
gzip -r mbrush-fw/mb_ser/css mbrush-fw/mb_ser/js mbrush-fw/mb_ser/img
gzip mbrush-fw/mb_ser/index.html mbrush-fw/mb_ser/sw.js

echo "$brand" > mbrush-fw/mb_ser/brand

tar cf "$outfile" mbrush-fw/
rm -rf mbrush-fw/
echo "done."

