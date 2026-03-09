MBrush2 Printer SDK
=======================================
(老版本 MBrush/PrinCube 见 maintenance 分支)

1. [通讯接口说明](#通讯接口说明)
2. [主板通讯说明](#主板通讯说明)
3. [打印位置说明](#打印位置说明)
4. [打印状态说明](#打印状态说明)
5. [CDBUS GUI 上位机](#cdbus-gui-上位机)
6. [网页转图和传输 Demo APP](#网页转图和传输-demo)
7. [命令行转图工具](#命令行转图工具)


支持的机型：
 - HK24<br>
   <img src="docs/img/hk24.jpg">
 - MBrush2<br>
   <img src="docs/img/mb2.jpg">
 - HK14<br>
   (Upcoming)


## 通讯接口说明

此串口通讯协议适用于打印机 RS-485 接口和 USB-CDC 串口。

串口基础协议参见：[CDNET 协议简介及示范](https://github.com/dukelec/cdnet/wiki/CDNET-协议简介及示范)

也可以通过蓝牙和 WiFi 转发数据包到 RS-485 总线，转发协议参见：[CD-ESP](https://github.com/dukelec/cd_esp/wiki/CD‐ESP-中文说明)

<img src="docs/img/block_diagram.svg">

Type-C 接口定义：

<img src="docs/img/typec_pinout.svg">

### USB 接口
 - USB 速度：High-speed（部分机型为 Full-speed）
 - 驱动：全平台免驱
 - CDC 串口速率：忽略，可为任意值
 - DTR 必须使能才可以通讯
 - 可以用目标地址 0x10 访问主板，用 0x20 地址访问 BLE 板（由主板自动代理，占用临时端口 bit4）
 - 引出 Encoder 接口的机型，Type-C 接口不再支持正反插

### RS-485 接口
 - 默认双速率：2 Mbps & 20 Mbps（参见 UART 控制器 [CDCTL01A 手册](https://dukelec.com/en/download.html)）
 - 可以配置为单速率，以便和传统 RS-485 硬件通讯
 - 定制机型可使用 50 Mbps 接口芯片，可以达到 50 Mbps 通讯速率
 - 多主通讯：譬如 BLE 板接收到按键事件会主动通知主板，主板打印状态改变会主动通知 BLE 板声光提示用户，总线会自动仲裁避免冲突
 - 打印机内部仅 RS-485 末端存在两个 330Ω 上下拉电阻，终端电阻默认未焊接
 - 部分机型 BLE 板和主板之间是 TTL 通讯，可通过 RS-485 访问 0x20 地址，主板会自动代理

### Encoder 接口
 - ENC+/ENC- 默认为 A/B 正交编码器接口 (ENC+: A, ENC-: B)
 - 也可以配置为 STEP/DIR 步进信号输入 (ENC+: STEP, ENC-: DIR)
 - 电平 3.3V


## 主板通讯说明

支持的 CDNET 功能端口，除了最后一个，其它是通用端口：
 - #01: 设备信息查询
 - #05: 参数表读写
 - #08: IAP 升级
 - #09: 打印调试上报
 - #0a: 波形调试上报
 - #14: 打印文件 dpt 传输

参数列表（通过端口 #05 读写，F 属性表示该值可以掉电保存，带 ! 表示重启生效）：

<table>
<tr> <th>Addr</th>   <th>Name</th>              <th>Attr</th>   <th>Type</th>   <th>Default</th>
     <th>Description</th>
</tr>
<tr> <td>0x0000</td> <td>magic_code</td>        <td>R/W</td>    <td>u16</td>    <td>0xcdcd</td>
     <td>固定值, 用于检测 flash 中是否存在有效寄存器表</td>
</tr>
<tr> <td>0x0002</td> <td>conf_ver</td>          <td>R/W</td>    <td>u16</td>    <td>0x0200</td>
     <td>寄存器表版本号，高字节为主版本号，低字节为子版本号</td>
</tr>
<tr> <td>0x0004</td> <td>conf_from</td>         <td>R</td>      <td>u8</td>     <td>0</td>
     <td>
        0: 当前为默认配置<br>
        1: 使用 flash 保存的配置<br>
        2: bt_mac 及之后为默认配置（仅主版本号匹配）
     </td>
</tr>
<tr> <td>0x0005</td> <td>do_reboot</td>         <td>R/W</td>    <td>u8</td>     <td>0</td>
     <td>
        写 1: 重启至 bootloader<br>
        写 2: 普通重启
     </td>
</tr>
<tr> <td>0x0007</td> <td>save_conf</td>         <td>R/W</td>    <td>u8</td>     <td>0</td>
     <td>写 1: 保存当前配置到 flash</td>
</tr>
<tr> <td>0x0008</td> <td>usb_online</td>        <td>R</td>      <td>u8</td>     <td>0</td>
     <td>0: Offline, 1: Online</td>
</tr>
<tr> <td>0x0009</td> <td>dbg_en</td>            <td>R/W/F</td>  <td>u8</td>     <td>0</td>
     <td>
        0: 不上报调试打印<br>
        1: 上报调试打印
     </td>
</tr>
<tr> <td>0x000c</td> <td>bus_mac</td>           <td>R/W/F!</td> <td>u8</td>     <td>0x10</td>
     <td>默认串口地址</td>
</tr>
<tr> <td>0x0010</td> <td>bus_baud_l</td>        <td>R/W/F!</td> <td>u32</td>    <td>2000000</td>
     <td>首字节默认速率 2Mbps</td>
</tr>
<tr> <td>0x0014</td> <td>bus_baud_h</td>        <td>R/W/F!</td> <td>u32</td>    <td>20000000</td>
     <td>后续字节默认速率 20Mbps</td>
</tr>
<tr> <td>0x0018</td> <td>bus_filter_m</td>      <td>R/W/F!</td> <td>u8[2]</td>  <td>0xff 0xff</td>
     <td>组播地址过滤器</td>
</tr>
<tr> <td>0x001a</td> <td>bus_mode</td>          <td>R/W/F!</td> <td>u8</td>     <td>1</td>
     <td>
        0: 传统半双工模式<br>
        1: 仲裁模式<br>
        2: BS 同步模式
     </td>
</tr>
<tr> <td>0x001c</td> <td>bus_tx_permit_len</td> <td>R/W/F!</td> <td>u16</td>    <td>20</td>
     <td>
        空闲后发送等待时间 (10 bits)<br>
        （串口配置时间单位：串口 1bit 时长）
     </td>
</tr>
<tr> <td>0x001e</td> <td>bus_max_idle_len</td>  <td>R/W/F!</td> <td>u16</td>    <td>200</td>
     <td>BS 模式最大等待时间 (10 bits)</td>
</tr>
<tr> <td>0x0020</td> <td>bus_tx_pre_len</td>    <td>R/W/F!</td> <td>u8</td>     <td>1</td>
     <td>
        TX 发送前提前使能 TX_EN 的时间 (2 bits)<br>
        （仲裁模式忽略）
     </td>
</tr>
<tr> <td>0x0024</td> <td>bt_mac</td>           <td>R/W/F</td>  <td>u8</td>     <td>0x30</td>
     <td>蓝牙板串口地址</td>
</tr>
<tr> <td>0x0026</td> <td>auto_spit_period</td>  <td>R/W/F</td>  <td>u16</td>    <td>21600</td>
     <td>自动喷废墨周期，单位秒，需要插 USB 保持开机状态（0 表示不启用）</td>
</tr>
<tr> <td>0x0028</td> <td>auto_spit_timer</td>   <td>R/W</td>    <td>u16</td>    <td>21600</td>
     <td>自动喷废墨倒计时，主动操作打印机会复位倒计时</td>
</tr>
<tr> <td>0x002a</td> <td>dbg_raw_msk</td>       <td>R/W</td>    <td>u8</td>     <td>0</td>
     <td>为 1 开启波形调试</td>
</tr>
<tr> <td>0x002c</td> <td>dbg_raw0</td>          <td>R/W/F</td>  <td>{u16 u16}[4]</td> <td>{0x0142,2}<br>{0x016c,8}<br>{0,0} {0,0}</td>
     <td>波形调试数据来源</td>
</tr>
<tr> <td>0x0070</td> <td>c_t0</td>              <td>R/W/F</td>  <td>f32</td>    <td>--</td>
     <td>用于墨盒温度校准（未使用）</td>
</tr>
<tr> <td>0x0074</td> <td>c_r0</td>              <td>R/W/F</td>  <td>f32[4]</td> <td>--</td>
     <td>用于墨盒温度校准（未使用）</td>
</tr>
<tr> <td>0x00b6</td> <td>enc_cfg</td>           <td>R/W/F!</td> <td>u8</td>     <td>--</td>
     <td>
        Bit1: 编码器模式选择                    <br>
         - 0: A/B 输入                          <br>
         - 1: STEP/DIR 输入                     <br>
        Bit0: 取反                              <br>
         - AB 模式：置 1 交换 AB 引脚           <br>
         - STEP/DIR 模式：置 1 取反 DIR 信号
     </td>
</tr>
<tr> <td>0x00b7</td> <td>enc_div</td>           <td>R</td>      <td>u8</td>     <td>--</td>
     <td>
        Bit7: 编码器倍频：<br>
          &nbsp; F_out = F_in × 2<br>
        Bit[6:0]: 编码器输入分频：<br>
          &nbsp; F_out = F_in ÷ (val + 1)<br>
        （由 dpt 打印文件自动设置）
     </td>
</tr>
<tr> <td>0x00b8</td> <td>enc_trig_f</td>        <td>R/W/F</td>  <td>u16</td>    <td>0x0100</td>
     <td>正向移动打印时，开始打印的位置</td>
</tr>
<tr> <td>0x00ba</td> <td>enc_trig_b</td>        <td>R/W/F</td>  <td>u16</td>    <td>0xfe00</td>
     <td>反向移动打印时，开始打印的位置</td>
</tr>
<tr> <td>0x00bc</td> <td>const_period</td>      <td>R/W/F</td>  <td>u16</td>    <td>0</td>
     <td>非 0 值表示启用匀速打印，速度单位 us</td>
</tr>
<tr> <td>0x00be</td> <td>print_dir</td>         <td>R</td>      <td>u8</td>     <td>0</td>
     <td>
        0: 正向移动打印<br>
        1: 反向移动打印<br>
        （由 dpt 打印文件自动设置）
     </td>
</tr>
<tr> <td>0x0141</td> <td>p_state</td>           <td>R</td>      <td>u8</td>     <td>0x18</td>
     <td>
        打印机状态（bit[2:0] 为 0 表示空闲）<br>
         - bit7 置位表示存在墨盒温度异常<br>
         - bit6 置位表示存在墨盒缺墨（未使用）<br>
         - bit5 置位表示存在墨盒不合法<br>
         - bit4 置位表示存在墨盒未安装<br>
         - bit3 置位表示无打印数据<br>
         - bit2 置位表示正在打印<br>
         - bit1 置位表示正在喷废墨 (spit)<br>
         - bit0 置位表示正在预热
     </td>
</tr>
<tr> <td>0x0142</td> <td>enc_val</td>           <td>R</td>      <td>u16</td>    <td>0</td>
     <td>位置编码器值（可通过 e_ctrl 手动清零）</td>
</tr>
<tr> <td>0x0144</td> <td>c_state</td>           <td>R</td>      <td>u8[4]</td>  <td>0x01</td>
     <td>
        墨盒状态（多墨盒以 CMYK 顺序重复）<br>
        - Bit[7:5]: (保留)<br>
        - Bit4: 0 温度过低; 1 温度过高<br>
        - Bit3: 置位表示温度异常<br>
        - Bit2: 置位表示墨水用尽（未使用）<br>
        - Bit1: 置位表示墨盒无效<br>
        - Bit0: 置位表示未检测到墨盒
     </td>
</tr>
<tr> <td>0x0148</td> <td>c_ink_count</td>      <td>R/W/F</td>   <td>f32[4]</td> <td>0</td>
     <td>墨量记录，顺序 CMYK，单位 mL</td>
</tr>
<tr> <td>0x0158</td> <td>c_temperature</td>    <td>R</td>       <td>f32[4]</td> <td>--</td>
     <td>喷头温度（多墨盒以 CMYK 顺序重复）</td>
</tr>
<tr> <td>0x0168</td> <td>temperature</td>      <td>R</td>       <td>f32</td>    <td>--</td>
     <td>环境温度</td>
</tr>
<tr> <td>0x016c</td> <td>prt_enc_pos</td>      <td>R</td>       <td>i32</td>    <td>--</td>
     <td>打印移动位置（详见打印位置说明）</td>
</tr>
<tr> <td>0x0170</td> <td>prt_dat_pos</td>      <td>R</td>       <td>i32</td>    <td>--</td>
     <td>文件打印位置（详见打印位置说明）</td>
</tr>
<tr> <td>0x0174</td> <td>voltage</td>          <td>R</td>       <td>f32</td>    <td>--</td>
     <td>单节 LiPo 电池电压 (V)</td>
</tr>
<tr> <td>0x0178</td> <td>current</td>          <td>R</td>       <td>f32</td>    <td>--</td>
     <td>喷头当前电流 (mA)</td>
</tr>
<tr> <td>0x017c</td> <td>dc_online</td>        <td>R</td>       <td>u8</td>     <td>--</td>
     <td>是否有接充电器</td>
</tr>
<tr> <td>0x01ac</td> <td>p_ctrl</td>           <td>R/W</td>     <td>u8</td>     <td>0</td>
     <td>
        打印控制<br>
        0x10: 取消任务<br>
        0x04: 启动打印<br>
        0x02: 喷废墨<br>
        0x01: 启动加热
     </td>
</tr>
<tr> <td>0x01ad</td> <td>d_ctrl</td>           <td>R/W</td>     <td>u8</td>     <td>0</td>
     <td>
        数据控制<br>
        0x10: 清除所有数据<br>
        0x04: 已提交文件追加数据（待实现）<br>
        0x02: 提交文件<br>
        0x01: 清除未提交数据
     </td>
</tr>
<tr> <td>0x01ae</td> <td>e_ctrl</td>           <td>R/W</td>     <td>u8</td>     <td>0</td>
     <td>
        编码器控制<br>
        0x10: 清零 enc_val
     </td>
</tr>
<tr> <td>0x01af</td> <td>c_ctrl</td>           <td>R/W</td>     <td>u8</td>     <td>0</td>
     <td>
        墨盒控制<br>
        0x08: 标定墨盒温度（未使用）
     </td>
</tr>
<tr> <td>0x01f0</td> <td>c_id</td>            <td>R</td>        <td>u32[4]</td> <td>--</td>
     <td>墨盒唯一编码</td>
</tr>
<tr> <td>0x0240</td> <td>psram_f_start</td>  <td>R</td>         <td>u32</td>    <td>0</td>
     <td>已提交文件开始地址</td>
</tr>
<tr> <td>0x0244</td> <td>psram_f_end</td>    <td>R</td>         <td>u32</td>    <td>0</td>
     <td>已提交文件结束地址</td>
</tr>
<tr> <td>0x0248</td> <td>psram_w_offset</td> <td>R/W</td>       <td>u32</td>    <td>0</td>
     <td>临时文件结束地址</td>
</tr>
<tr> <td>0x024c</td> <td>p14_cnt</td>        <td>R/W</td>       <td>u8</td>     <td>0</td>
     <td>文件传输端口当前 cnt 值</td>
</tr>
<tr> <td>0x024d</td> <td>p14_err</td>        <td>R/W</td>       <td>u8</td>     <td>0</td>
     <td>文件传输端口当前错误标志</td>
</tr>
</table>


### 打印数据传输

需要传输的是 dpt 私有格式文件，图片转换方法见本文后续章节。

文件传输有关寄存器有以下：

 - psram_f_start 到 psram_f_end 为已提交的文件头尾地址，相等表示无打印文件
 - psram_f_end 到 psram_w_offset 为正在写入的文件头尾地址，相等表示未写入
 - p14_cnt 和 p14_err 为 0x14 写文件功能端口的状态，可以查询和修改

储存器是环形 buffer, 空间大小是 8 MB, 通过相减计算文件大小要与上 `0x7fffff`.


#### 功能端口 0x14: 写入打印数据

命令定义如下：

```
write:  [data]
return: [err_flag_8, p_state_8, enc_val_16, psram_w_offset_32]
```

`data` 为 dpt 文件切片，单次传输最多 251 字节。

临时端口号：
 - Bit3 为 1 时该端口不回复，为 0 正常回复
 - Bit[2:0] 为自增序号 cnt，文件的首包序号为 0，如果序号出错，则置位错误标记，并丢弃数据

修改 p14_cnt / p14_err 的方式：
 - 直接读写 p14_cnt / p14_err 寄存器
 - 使用 d_ctrl 寄存器清零
 - 0x14 端口写入 1 个 data 长度为 0 的空包

回复：
 - err_flag 为 0 时表示没有错误，为 1 时表示 cnt 错误，错误清除前丢弃后续写入的数据
 - p_state 为打印机当前状态
 - enc_val 是位置编码器当前计数
 - psram_w_offset 是当前数据包写入成功时的 psram_w_offset 值


#### 高效传输方式

每个命令都要求回复可以确保数据正确写入，但是传输效率会很低，为了提高传输效率，可使用以下方式：

 1. 最多同时传输两组数据包，每组有多个数据包，仅最后一个包要求回复
 2. 每当接收到前一组的回复，若没有错误，则再追加发送新一组数据包

示范（一组 5 个数据包）：  
<img src="docs/img/send_file.svg">


更简单的做法是：整个文件仅最后一个包请求回复，如果出错，清除数据再整体重新传输。适合有线通讯。


#### 边打印边传输

打印机支持一边打印一边传输下一个文件。

传输一个文件结束后，要往 d_ctrl 寄存器写入 0x02 告诉打印机传输完毕，进行文件更新。  
如果上一个文件正在打印，要等待打印完成再进行文件更新，否则会干扰当前打印。

如果传入一份打印数据后不再更新，则每次打印相同内容。

待实现：正在打印时为已提交的文件追加内容，以实现无限长度打印。


#### Python 脚本传数据 demo

```
$ cd cli_tools/serial_send_file
$ ./send_dpt.py --file xxx.dpt
```

可以增加 `--verbose` 参数查看串口底层数据包。



## 打印位置说明

#### 打印触发位置

<img src="docs/img/print_trig.svg">

如图所示范，enc_val 为打印机当前位置。

启动正向打印后：
 1. 打印机进入预热模式
 2. 随打印机移动 enc_val 向右递增
 3. 当 enc_val 达到 enc_trig_f 所在位置，进入打印模式

启动反向打印后：
 1. 打印机进入预热模式
 2. 随打印机移动 enc_val 向左递减
 3. 当 enc_val 达到 enc_trig_b 所在位置，进入打印模式


#### 打印进度

 - prt_enc_pos 是 enc_val 的多圈扩充和 enc_trig_f/b 之间的差值，无论正反方向打印，都是沿打印方向由负到正递增。0 点位置是触发打印的位置。
 - prt_dat_pos 为打印数据的位置，负值表示正在预热，正值达到打印文件的总打印次数时结束打印。

进入打印预热时，prt_dat_pos 为一个较大的负数，匀速向 0 点移动，耗时 1 分钟达到 0 点时，退出加热并在 0 点等候。

<img src="docs/img/print_pos0.svg">

prt_enc_pos 随打印机移动达到 0 点时，如果 prt_dat_pos 还是负数会直接跳到 0。

然后 prt_enc_pos 会从左侧推着 prt_dat_pos 向右移动：

<img src="docs/img/print_pos1.svg">

以下模式会忽略 prt_enc_pos：
 - 纯加热模式，prt_dat_pos 达到 0 点退出加热，回到空闲模式。
 - 喷废墨模式，prt_dat_pos 开始为一个较小的负值，加热几秒后达到正值开始喷废墨，然后回到空闲模式。
 - 匀速打印模式，prt_dat_pos 开始的值为 -enc_trig_f, 并全程以 const_period 速度递增和打印。


## 打印状态说明

使用 p_ctrl 寄存器控制打印：
 - 写入 0x01 开启预热
 - 写入 0x02 喷一次废墨（等同长按按键；喷废墨前会自动预热几秒）
 - 写入 0x04 开始打印（等同短按按键；支持从预热模式直接跳转到打印模式）
 - 写入 0x10 取消当前任务回到空闲（等同非空闲时短按按键取消当前任务）


譬如执行一次喷废墨（写入 02），p_state 变化为："空闲" -> "预热 + 喷废墨" -> "喷废墨" -> "空闲"

譬如执行一次打印，建议先单独开启预热功能（写入 01），p_state 变化为："空闲" -> "预热"

在预热的状态下进行数据传输，数据就绪后，开始打印（写入 04），p_state 变化为："预热" -> "预热 + 打印"

当打印机移动到启始打印位置时，会退出预热模式，进入正式打印阶段，p_state 变化为："预热 + 打印" -> "打印"

打印完成后，p_state 回到空闲："打印" -> "空闲"



## CDBUS GUI 上位机

拷贝 gui_configs 目录下的文件到 [CDBUS GUI](https://github.com/dukelec/cdbus_gui) 的 configs 目录下。

串口号填写相应串口号，譬如 `ttyACM0`、`COM4`，或者填写 `2E3C:5740` 等可以匹配上的子字符串，波特率按实际填写，默认 20000000 bps.  
（[cdbridge](https://github.com/dukelec/cdbus_bridge) s1.2 开关需要切换到 ON 设定低速限速 2Mbps；通过 usb 口直连打印机时，波特率可以是任意值。）

目标地址填 `00:00:10`，目标配置选择 `dprinter.json`，最左边名称随便填写。

<img src="docs/img/gui0.avif" alt="Your browser may not support avif images!">

<img src="docs/img/gui1.avif">



## 网页转图和传输 Demo

可以直接访问网址：https://p.d-l.io

需要使用支持 Web BLE 的浏览器：
 - iOS 用户：需要使用 Bluefy 浏览器
 - Android 用户：可使用 Chrome, Samsung Internet, 或 Opera 浏览器
 - PC 用户：可以使用 Chrome, Edge, 或 Opera 浏览器

本地部署：
 - 运行脚本 `web_demo/start_web_server.sh`
 - 然后使用浏览器打开页面 `http://localhost:7000`



## 命令行转图工具

进入 `cli_tool/image_convert` 下面对应的型号目录，执行：

`$ node dpconv.js input.png -1 --dbg`

参数 `-1` 是转单行打印数据，不带 `-1` 可以生成多行数据，用于拼接打印大幅内容。

具体参数说明请查看帮助：

`$ node dpconv.js --help`

