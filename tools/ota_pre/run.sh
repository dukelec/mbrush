#!/bin/sh

rm -rf /root/mb_ser_new
mv mbrush-fw/mb_ser /root/mb_ser_new
mv mbrush-fw/mb_conf /root/mb_conf_new
mv mbrush-fw/mb_etc /root/mb_etc_new

dd if=mbrush-fw/uImage of=/dev/mtdblock1 bs=4k
rm -rf mbrush-fw

cd /root
rm -rf mb_ser mb_conf mb_etc

mv mb_ser_new mb_ser
mv mb_conf_new mb_conf
mv mb_etc_new mb_etc

sync
nohup sh -c "sleep 4 && reboot" > /dev/null &

