#!/bin/sh

set -e

sing-box run -D /var/lib/sing-box -C /etc/sing-box &

sleep 3

echo "sing-box is up!"

exec proxychains4 node --enable-source-maps /app/dist/index.js
