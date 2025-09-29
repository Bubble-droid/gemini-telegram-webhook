#!/bin/sh

set -e

sing-box run -D /var/lib/sing-box -C /etc/sing-box &

echo "sing-box is up!"

echo "nameserver 127.0.0.1" >| /etc/resolv.conf

echo "precedence ::ffff:0:0/96 0" >> /etc/gai.conf &&
  echo "precedence ::/0 50" >> /etc/gai.conf

exec proxychains4 node --enable-source-maps /app/dist/index.js
