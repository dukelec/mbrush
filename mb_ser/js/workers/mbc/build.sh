#!/bin/bash
cd "$(dirname "$0")"

if [ "$1" != "node" ]; then
    echo "generate: mbc-m.js"
    cat mbc-head.js mbc.js > mbc-m.js
else
    echo "generate: mbc-node.js"
    cat mbc-head-node.js mbc.js > mbc-node.js
    chmod +x mbc-node.js
fi

