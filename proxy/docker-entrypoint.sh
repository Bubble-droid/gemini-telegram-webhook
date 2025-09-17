#!/bin/sh
set -e

# 使用 & 后台运行
sing-box run -D /var/lib/sing-box -C /etc/sing-box &

# 检查 sing-box 代理端口是否就绪
count=0
while ! nc -z localhost 10080 && [ $count -lt 30 ]; do
    echo "Waiting for sing-box to start..."
    sleep 1
    count=$((count+1))
done

if [ $count -ge 30 ]; then
    echo "Error: sing-box failed to start in time. Exiting."
    exit 1
fi

echo "sing-box is up!"

echo "nameserver 127.0.0.1" >| /etc/resolv.conf

echo "precedence ::ffff:0:0/96 0" >> /etc/gai.conf \
    && echo "precedence ::/0 50" >> /etc/gai.conf

# 将 PID1 换成 proxychains4 node（proxychains4 位于 PATH）
exec proxychains4 node --enable-source-maps /app/dist/index.js
