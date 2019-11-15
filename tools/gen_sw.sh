
files="$(find ./ -not -path '*/\.*' -type f)"

echo '    "/",'
echo "$files" | while read -r line; do
    line="${line:1}"
    [[ "$line" == "/httpd.conf" ]] && continue
    [[ "$line" == "/index.html" ]] && continue
    [[ "$line" == "/sw.js" ]] && continue
    [[ "$line" =~ ^"/upload/" ]] && continue
    [[ "$line" =~ ^"/cgi-bin/" ]] && continue
    echo "    \"$line\","
done

