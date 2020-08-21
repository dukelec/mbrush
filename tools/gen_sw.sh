#!/bin/bash

cd "$(dirname "$0")/../mb_ser"

files="$(find ./ -not -path '*/\.*' -type f)"

echo "$files" | while read -r line; do
    line="${line:1}"
    file="$line"
    [[ "$line" == "/httpd.conf" ]] && continue
    [[ "$line" == "/version" ]] && continue
    [[ "$line" == "/sw.js" ]] && continue
    [[ "$line" =~ ^"/upload/" ]] && continue
    [[ "$line" =~ ^"/cgi-bin/" ]] && continue
    [[ "$line" =~ ^"/demo/" ]] && continue
    [[ "$line" == "/index.html" ]] && line="/"
    echo "    \"$line\" : \"$(sha256sum "./$file" | awk '{ print $1 }')\","
done

