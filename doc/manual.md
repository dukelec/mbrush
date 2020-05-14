PrinCube Manual
======

<img src="princube.svg">  

1. Start/Stop Button
2. Status Indicator
3. Print Head Nozzles
4. Optical Sensor
5. Open/Lock Toggle
6. Roller
7. ON/OFF Toggle

### What's In The Box
 - PrinCube
 - Base Dock
 - Clean Brush
 - PrinCube Standard Ink Cartridge
 - Advanced Printing Holder
 - Two Rulers
 - Type-C Charging Cable
 - PrinCube Manual


## Basic Operation

### Install cartridge

1. Remove the protective case and protective film on the ink cartridge;
2. Remove the printer base and pull the toggle switch to ‘OPEN’, then open the transparent cover;
3. Put the cartridge into the printer's ink tank, making sure that it’s fully secured. Close the transparent cover and pull the toggle switch to ‘LOCK’.

Notes:
 - To open and lock the transparent cover, keep the cover in the closed position and then toggle the switch;
 - If the ink cartridge is not used for a long time, it is recommended to put it back in the cartridge protective case.


### Open APP

1. Turn on the power switch on the bottom of the printer and wait for 5 seconds to get ready to go with a beep.

#### Connect through WiFi:

2. Search for WiFi with your device (such as a mobile phone). Find ‘PrinCube-XXXX’ and connect. (Default password: 12345678)
3. Use the camera app to scan the QR code on the inner side of the base or enter the address `192.168.44.1` or `[fd44::1]` in your browser to open the app.

#### Connect through USB:

2. Connect the USB cable to your device (such as a laptop).
3. For MacOS and Linux, no drive required. For Windows, should install driver first: <a href="win_driver">win_driver</a>
3. Enter the address `192.168.88.1` or `[fd88::1]` in your browser to open the app.

Notes:
 - The address is only accessible when WiFi or USB is connected to the PrinCube network.
 - If the Android system cannot access the address normally, please turn off the automatic network switching function, and ignore or select ‘No’ when popping up the notification of using the mobile network.
 - Please use the QR code scanning tool that does not rely on the Internet, or enter the address manually.
 - This APP is tested on Chrome, Safari and Firefox.


### Print Operation

1. Turn on the power switch on the bottom of the printer and wait for 5 seconds to get ready to go with a beep.
2. Place the printer on the test paper and press the button for 1 second to automatically clean the nozzle. It may take several times to ensure that the entire 3 colored lines are ejected.
3. Place the printer on the surface of the object to be printed.
4. Click the button, the green indicator light is on, and it’s ready to print.
5. Slide the printer to the direction you want to complete the print operation. The green light goes off when it’s finished.

Notes:
 - If the nozzle is dirty, please push out the brush in the base to clean the nozzle;
 - If the nozzle is particularly dry, please pour a little water on the table, remove the cartridge, and soak the nozzle in water for about 1 minute.



### App Operation

1. Click ‘New’ to create a new file.
2. Click ‘Add image’ or ‘Add text’ to add content.
3. Click on the image or text to move, rotate and zoom. (Click the selected text again to re-edit the content.)
4. After the material is added, click ‘Print Preview’ to enter the Crop mode.
5. Click the default crop box shown in the edit area, adjust the crop box to fit the desired pattern area.
6. Click ‘Print’ to send the pattern to the printer.


### Button Operation and Status Indication
 - 5 seconds after power-on, it enters the ready state, followed by one beep, and the white lights in the middle and both sides are on;

 - In the ready state, click the button to enter the print state. The white lights on both sides turn to green. Sliding the printer to complete the printing (The continuous prompt tone will be sounded if the sliding is too fast). It will automatically return to the ready state when the printing is completed;

 - In the ready state, press and hold the button to enter the cleaning state, the white lights on both sides turn to green. Keep the printer still, wait for a while and it will automatically return to the ready state;

 - In the print state, click the button to return to the ready state. If it is in the middle of multiple-line printing, the next line will be printed when you re-press the button again (return to first line if press and hold the button instead);

 - Press and hold the button, then turn on the power switch to enter the programming mode;
 - After turning on the power switch, press and hold the button within 5 seconds until the white lights on both sides flash, which will restore the factory settings;

 - When the battery is low, the middle white light flashes;
 - The charging indicator is next to the USB port (Type-C). Charging: Yellow | Fully Charged: Green


## Advanced Operation

### Multiple-line Printing

In the Crop mode, you can add multiple crop boxes for multiple-line print. (Each box for one line printing.)  
When you are done with the pattern editing and cropping, press the button for the first line printing. Move the printer to the next line and press the button again for second-line printing. Follow the same manner to finish the rest lines.


### Multiple-line Aligning

When you are done with the first line cropping, you can use the ‘Duplicate downward’ option to duplicate the first box, making sure the multiple-line printing is aligned.

### Ultra-wide Pattern Printing

For ultra-wide pattern printing, errors may happen and the conversion process is longer than the regular pattern printing. You can edit the very first crop box on the left and use the ‘Duplicate right’ option to duplicate the first box.

### Software Offline Operation

1. Go to the app setting page (check the sidebar on the home page).
2. Download the https certificate and install it.
3. Click the https link at the bottom of the app setting page.
4. Use browser option (‘Share’ function): Save page to desktop/home page.

Notes:
 - Software features need to be used online first before they can be used offline.

#### Installed Certificate in iOS
1. Click the certificate link on the APP Settings page to download the certificate.
2. Goto Settings > Profile Downloaded > Install the certificate.
3. Goto Settings > General > About > Certificate Trust Settings. Under "Enable full trust for root certificates," turn on trust for the downloaded certificate.

#### Installed Certificate in Android
1. Click the certificate link on the APP Settings page to download the certificate.
2. Goto Settings > Lock screen & security > Install from device memory/SD card > Select the certificate.

