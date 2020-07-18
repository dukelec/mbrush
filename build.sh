git fetch --all
git reset --hard origin/master
./tools/release_fw.sh
chmod 777 ./build.sh