#!/usr/bin/env python3
#
# Release helper, for each project under web/ which contains sw.js:
#  - update version in index.html (after app_name: "/ vX.Y")
#  - update version in sw.js cache_name ('PROJECT-X.Y')
#  - re-generate the cache_files hash list in sw.js
#
# Usage: ./gen_sw_list.py VERSION [PROJECT ...]
#  e.g.: ./gen_sw_list.py 2.x          # update all projects
#        ./gen_sw_list.py 2.x hk24     # update specified projects only

import os, re, sys, hashlib

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for blk in iter(lambda: f.read(65536), b''):
            h.update(blk)
    return h.hexdigest()

def list_files(root):
    # same as: find -L ./ -not -path '*/.*' -type f
    ret = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        for fn in filenames:
            if fn.startswith('.'):
                continue
            full = os.path.join(dirpath, fn)
            if os.path.isfile(full):
                ret.append('/' + os.path.relpath(full, root))
    return sorted(ret)

def sub_check(pattern, repl, text, desc, flags=0):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        sys.exit(f'error: pattern not found: {desc}')
    return new

def update_project(web, pre, version):
    root = os.path.join(web, pre)

    # update index.html first, its hash goes into the list below
    idx = os.path.join(root, 'index.html')
    html = open(idx).read()
    html = sub_check(r'(id="app_name"></span> / v)[^<]*', lambda m: m.group(1) + version,
                     html, f'{pre}/index.html app_name version')
    open(idx, 'w').write(html)

    entries = []
    for rel in list_files(root):
        if rel in ('/httpd.conf', '/sw.js') or rel.startswith('/cgi-bin/'):
            continue
        key = '/' if rel == '/index.html' else rel
        entries.append((key, sha256_file(root + rel)))
    entries.sort()
    lines = [f'    "/{pre}{key}" : "{sha}"' for key, sha in entries]

    sw = os.path.join(root, 'sw.js')
    js = open(sw).read()
    js = sub_check(r"(var cache_name = '" + re.escape(pre) + r"-)[^']*'",
                   lambda m: m.group(1) + version + "'", js, f'{pre}/sw.js cache_name')
    block = 'var cache_files = {\n' + ',\n'.join(lines) + '\n};'
    js = sub_check(r'var cache_files = \{.*?\};', lambda m: block,
                   js, f'{pre}/sw.js cache_files', flags=re.S)
    open(sw, 'w').write(js)
    print(f'{pre}: version -> {version}, {len(lines)} files listed')

if len(sys.argv) < 2:
    print('e.g.: ./gen_sw_list.py 2.x [hk24 ...]')
    sys.exit(1)

version = sys.argv[1]
web = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
projects = sys.argv[2:]
if not projects:
    projects = sorted(d for d in os.listdir(web) if os.path.isfile(os.path.join(web, d, 'sw.js')))
for pre in projects:
    update_project(web, pre, version)
