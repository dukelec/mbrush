#!/usr/bin/env python3

import sys
import time
import math
import struct
import _thread
import numpy as np
import matplotlib.pyplot as plt
from mpl_interaction import figure_pz


if len(sys.argv) <= 1:
    print(f'usage: {sys.argv[0]} dat_file')
    exit(-1)

print('open data file: %s' % sys.argv[1])


with open(sys.argv[1], 'rb') as f:
    dat = f.read()

print("dat len", len(dat))

t_array = []
td_array = []
tavg_array = []
x_array = []
iqc_array = []

DEEP = 20000

for i in range(DEEP):
    t = struct.unpack("<I", dat[i*4 : i*4+4])[0]
    if t == 0:
        break
    t_array.append(t)
    td_array.append(struct.unpack("<I", dat[DEEP*4+i*4 : DEEP*4+i*4+4])[0]) # *26/20)
    tavg_array.append(struct.unpack("<I", dat[DEEP*8+i*4 : DEEP*8+i*4+4])[0])
    x_array.append(struct.unpack("<b", dat[DEEP*12+i : DEEP*12+i+1])[0] * 1000)
    iqc_array.append(struct.unpack("<B", dat[DEEP*13+i : DEEP*13+i+1])[0] * 10)

#print(td_array)
print("t_array len", len(t_array))

fig = figure_pz() #plt.figure()
ax = fig.add_subplot(1, 1, 1)

plt.setp(ax.plot(t_array, x_array, 'r.-'), alpha=0.2) # red
plt.setp(ax.plot(t_array, td_array, 'b.-'), alpha=0.2) # blue
plt.setp(ax.plot(t_array, tavg_array, 'y.-'), alpha=0.2) # yellow
plt.setp(ax.plot(t_array, iqc_array, 'g.-'), alpha=0.2)

plt.tight_layout()
plt.grid()
plt.show()
