#!/bin/bash

[[ "$1" == "" ]] && { echo "e.g.: ./gen_sw.sh hk24"; exit 1; }

cd "$(dirname "$0")/web"

pre="$1"
cd "$pre" || exit 1

files="$(find -L ./ -not -path '*/\.*' -type f)"

echo "$files" | while read -r line; do
    line="${line:1}"
    file="$line"
    [[ "$line" == "/httpd.conf" ]] && continue
    [[ "$line" == "/sw.js" ]] && continue
    [[ "$line" =~ ^"/cgi-bin/" ]] && continue
    [[ "$line" == "/index.html" ]] && line="/"
    echo "    \"/$pre$line\" : \"$(sha256sum "./$file" | awk '{ print $1 }')\","
done

