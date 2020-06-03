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
After running the following command, open the URL with your browser: `http://localhost:8000`.
```
github_mb $ busybox httpd -h mb_ser -c httpd.conf -f -p 8000 -vv
```

## Build
Run the command `./release_fw.sh` to generate a tar package that can be used for firmware upgrades.
```
github_mb/tools $ ./release_fw.sh
or:
github_mb/tools $ ./release_fw.sh "brand_name"
```

