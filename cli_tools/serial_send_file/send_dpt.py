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
R_dptz_rx = 0x023c
R_p14_cnt = 0x024c

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

ack_max = 15
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


def prepare_tx_pkts(dat):
    cur = 0
    pkt_cnt = 0
    ack_cnt = 0
    dpt_pkts = []
    while True:
        size = min(sub_size, len(dat) - cur)
        if size == 0:
            break
        wdat = dat[cur:cur+size]
        ack_bit = 0x8
        ack_cnt += 1
        if ack_cnt >= ack_max or cur + size == len(dat):
            ack_bit = 0
            ack_cnt = 0
        port = 0x60 | (pkt_cnt & 7) | ack_bit
        dpt_pkts.append((port, wdat))
        pkt_cnt += 1
        cur += size
    return dpt_pkts


def clear_data_rx():
    for s in sock_list:
        s.clear()


def write_data(dpt_pkts, dptz_size):
    pend_ret = []
    w_idx = 0
    clear_data_rx()

    while True:
        if len(pend_ret) < 2 and w_idx < len(dpt_pkts):
            while True:
                port, dat = dpt_pkts[w_idx]
                sock_list[port & 0xf].sendto(dat, (target_addr, 20))
                w_idx += 1
                if not (port & 0x8):
                    pend_ret.append(port)
                    break
        elif len(pend_ret):
            port = pend_ret[0]
            rx, _ = sock_list[port & 0xf].recvfrom(timeout=2.5)
            if rx != None and len(rx) and rx[0] == 0:
                print(f'  write ret: {rx.hex()}')
                pend_ret.pop(0)
            else:
                if rx != None:
                    print(f'  write ret error: {rx.hex()}')
                clear_data_rx()
                csa_dat = None
                for _ in range(3):
                    csa_dat = csa_read(R_dptz_rx, 18)
                    if csa_dat != None and len(csa_dat) >= 19:
                        break
                if csa_dat == None or len(csa_dat) < 19:
                    return -1
                print(f'  retry rx: {csa_dat.hex()}')
                dptz_rx, csa_cnt, csa_err = struct.unpack_from("<I12xBB", csa_dat, 1)
                if dptz_rx > dptz_size:
                    print(f'dptz_rx error: {dptz_rx} > {dptz_size}')
                    return -1
                if dptz_rx == dptz_size:
                    print(f'dptz_rx {dptz_rx}, all data received')
                    w_idx = len(dpt_pkts)
                    pend_ret.clear()
                    clear_data_rx()
                    break
                ack_idx = dptz_rx // sub_size
                set_cnt = dpt_pkts[ack_idx][0] & 7
                print(f'dptz_rx {dptz_rx} -> {ack_idx * sub_size} ({w_idx * sub_size}), cnt {csa_cnt} -> {set_cnt}, err {csa_err}')
                csa_write(R_p14_cnt, struct.pack("<BB", set_cnt, 0))
                w_idx = ack_idx
                pend_ret.clear()
                clear_data_rx()
        else:
            print('write_data done')
            break
    return 0


with open(in_file, 'rb') as f:
    dat = f.read()
print(f'write {len(dat)} bytes from file', in_file)

csa_write(R_d_ctrl, b'\x10') # clear file and drafts
#csa_write(R_quad_div, b'\x10')

dpt_pkts = prepare_tx_pkts(dat)
if write_data(dpt_pkts, len(dat)):
    print('write data error')
    exit(-1)

csa_write(R_d_ctrl, b'\x02') # submit file
csa_write(R_e_ctrl, b'\x10') # reset encoder
#csa_write(R_p_ctrl, b'\x04') # start print

print('done.')

sleep(60)
