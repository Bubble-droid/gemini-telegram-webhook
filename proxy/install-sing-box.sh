#!/bin/sh

mkdir -p /etc/apt/keyrings &&
  curl -fsSL https://sing-box.app/gpg.key -o /etc/apt/keyrings/sagernet.asc &&
  chmod a+r /etc/apt/keyrings/sagernet.asc &&
  echo '
Types: deb
URIs: https://deb.sagernet.org/
Suites: *
Components: *
Enabled: yes
Signed-By: /etc/apt/keyrings/sagernet.asc
' | tee /etc/apt/sources.list.d/sagernet.sources &&
  apt-get update &&
  apt-get install -y sing-box-beta
