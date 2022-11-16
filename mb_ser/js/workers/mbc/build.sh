#!/bin/bash
cd "$(dirname "$0")"

echo "generate: mbc-m.js"
cat mbc-head.js mbc.js > mbc-m.js

