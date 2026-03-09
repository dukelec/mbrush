#!/usr/bin/env python3
# Software License Agreement (BSD License)
#
# Copyright (c) 2018, DUKELEC, Inc.
# All rights reserved.
#
# Author: Duke Fong <d@d-l.io>

"""DPrint Write Tool

--file=PATH-TO-DPT-FILE
--dev=COM-PORT
--baud=20000000

"""

R_conf_ver = 0x0002 # len: 2
R_conf_from = 0x0004 # len: 1
R_do_reboot = 0x0005 # len: 1
R_keep_in_bl = 0x0006 # len: 1
R_save_conf = 0x0007 # len: 1

R_p_ctrl = 0x01ac
R_d_ctrl = 0x01ad
R_e_ctrl = 0x01ae

import sys, os
import struct
import _thread
import re
from time import sleep
from argparse import ArgumentParser
from pathlib import Path

sys.path.append(os.path.join(os.path.dirname(__file__), './pycdnet'))

from cdnet.utils.log import *
from cdnet.utils.cd_args import CdArgs
from cdnet.dev.cdbus_serial import CDBusSerial
from cdnet.dispatch import *

args = CdArgs()
local_mac = 0
dev_str = args.get("--dev", dft=":5740")
baud = int(args.get("--baud", dft="20000000"), 0)
target_addr = args.get("--target-addr", dft="00:00:10")

in_file = args.get("--file")

sub_size = 250

if args.get("--help", "-h") != None:
    print(__doc__)
    exit()

if not in_file:
    print(__doc__)
    exit()

if args.get("--verbose", "-v") != None:
    logger_init(logging.VERBOSE)
elif args.get("--debug", "-d") != None:
    logger_init(logging.DEBUG)
elif args.get("--info", "-i") != None:
    logger_init(logging.INFO)


dev = CDBusSerial(dev_str, baud=baud)
CDNetIntf(dev, mac=local_mac)
sock = CDNetSocket(('', 0x40))
sock_dbg = CDNetSocket(('', 9))

sock_list = [
    CDNetSocket(('', 0x60)), CDNetSocket(('', 0x61)), CDNetSocket(('', 0x62)), CDNetSocket(('', 0x63)),
    CDNetSocket(('', 0x64)), CDNetSocket(('', 0x65)), CDNetSocket(('', 0x66)), CDNetSocket(('', 0x67)),
    CDNetSocket(('', 0x68)), CDNetSocket(('', 0x69)), CDNetSocket(('', 0x6a)), CDNetSocket(('', 0x6b)),
    CDNetSocket(('', 0x6c)), CDNetSocket(('', 0x6d)), CDNetSocket(('', 0x6e)), CDNetSocket(('', 0x6f))
]


def dbg_echo():
    while True:
        rx = sock_dbg.recvfrom()
        #print('\x1b[0;37m  ' + re.sub(br'[^\x20-\x7e]',br'.', rx[0][5:-1]).decode() + '\x1b[0m')
        print('\x1b[0;37m  ' + re.sub(br'[^\x20-\x7e]',br'.', rx[0]).decode() + '\x1b[0m')

_thread.start_new_thread(dbg_echo, ())


def csa_write(offset, dat):
    sock.sendto(b'\x20' + struct.pack("<H", offset) + dat, (target_addr, 5))
    ret, _ = sock.recvfrom(timeout=1)
    if ret == None or ret[0] != 0:
        print(f'csa_write error at: 0x{offset:x}: {dat.hex()}')
    return ret

def csa_read(offset, len_):
    sock.sendto(b'\x00' + struct.pack("<HB", offset, len_), (target_addr, 5))
    ret, _ = sock.recvfrom(timeout=1)
    if ret == None or ret[0] != 0:
        print(f'csa_write read at: 0x{offset:x}, len: {len_}')
    return ret


cur_cnt = 0


def _write_data(dat, cur, is_last):
    global cur_cnt    
    ##print(f'  {cur:06x}, cnt: {cur_cnt:02x} ' + dat.hex())
    hdr = None
    if cur == 0 or is_last:
        s = sock_list[cur_cnt]
        s.sendto(dat, (target_addr, 20))
        ret, _ = s.recvfrom()
        print('  write ret: ' + ret.hex())
        if ret[0] != 0:
            print('write data error')
            exit(-1)
    else: # no return
        s = sock_list[8 | cur_cnt]
        s.sendto(dat, (target_addr, 20))
        #sleep(0.00258) # 1÷1000000×10×258
    cur_cnt = (cur_cnt + 1) & 7

def write_data(dat):
    cur = 0
    while True:
        size = min(sub_size, len(dat) - cur)
        if size == 0:
            break
        wdat = dat[cur:cur+size]
        is_last = cur+size == len(dat)
        _write_data(wdat, cur, is_last)
        cur += size


with open(in_file, 'rb') as f:
    dat = f.read()
print(f'write {len(dat)} bytes from file', in_file)

csa_write(R_d_ctrl, b'\x10') # clear file and drafts
#csa_write(R_quad_div, b'\x10')

write_data(dat)

csa_write(R_d_ctrl, b'\x02') # submit file
csa_write(R_e_ctrl, b'\x10') # reset encoder
#csa_write(R_p_ctrl, b'\x04') # start print

print('done.')

sleep(60)


