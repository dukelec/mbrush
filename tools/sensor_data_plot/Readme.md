1. Get sensor data on the board

```
dd if=/sys/mb/pos_dat of=pos_dat bs=280 count=1000
```

2. Transfer the data to PC

3. Plot the data

```
$ ./plt.py pos_dat
```
