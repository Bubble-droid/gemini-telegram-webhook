#!/bin/sh
set -e

# 启动 sing-box（配置位于 /etc/sing-box/config.json）
# 使用 & 后台运行
sing-box -D /var/lib/sing-box -C /etc/sing-box run &

# 等待本地 socks 端口就绪（简单等待 + 可替换为循环检测端口）
sleep 1

# 将 PID1 换成 proxychains4 node（proxychains4 位于 PATH）
# proxychains4 会读取 /etc/proxychains.conf
exec proxychains4 node --enable-source-maps /app/dist/index.js
