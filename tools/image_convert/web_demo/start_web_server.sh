#!/bin/bash

echo "please open url: http://localhost:7000/"
busybox httpd -h ./ -c httpd.conf -f -p 7000 -vvv


