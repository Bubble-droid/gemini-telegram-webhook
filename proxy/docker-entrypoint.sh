#!/bin/sh

set -e

# 定义原本要运行的 node 命令
NODE_CMD="node --enable-source-maps /app/dist/index.js"

# 检查环境变量 ENABLE_PROXY
# 如果设置为 "true"，则启动 sing-box 并通过 proxychains 运行程序
if [ "$ENABLE_PROXY" = "true" ]; then
  echo "Proxy mode ENABLED."

  echo "Starting sing-box..."
  sing-box run -D /var/lib/sing-box -C /etc/sing-box &

  # 只有开启代理模式时才需要等待 sing-box 启动
  sleep 3
  echo "sing-box is up!"

  echo "Starting application with proxychains..."
  exec proxychains4 $NODE_CMD
else
  echo "Proxy mode DISABLED. Running direct connection."

  echo "Starting application directly..."
  exec $NODE_CMD
fi
