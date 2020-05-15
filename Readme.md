PrinCube APP
======
Print anything, anywhere, anytime.

<img src="doc/princube.png" width="400px">  

## Documents
 - English Manual: <a href="doc/manual.md">doc/manual.md</a>
 - English FAQ (Important): <a href="http://blog.d-l.io/mb-faq">http://blog.d-l.io/mb-faq</a>
 - 中文手冊：<a href="doc/manual_hk.md">doc/manual_hk.md</a>
 - 中文故障處理（必讀）：<a href="http://blog.d-l.io/mb-faq-cn">http://blog.d-l.io/mb-faq-cn</a>
 - Japanese Manual: <a href="doc/manual_ja.md">doc/manual_ja.md</a>
 - Development API: <a href="doc/dev.md">doc/dev.md</a>

## Test
Open `http://localhost:8000` in your browser after you run it:
```
github_mb $ busybox httpd -h mb_ser -c httpd.conf -f -p 8000 -vv
```

## Build
Execute `./release_fw.sh` to generate a tarball for the firmware update.
```
github_mb/tools $ ./release_fw.sh
or:
github_mb/tools $ ./release_fw.sh "brand_name"
```

