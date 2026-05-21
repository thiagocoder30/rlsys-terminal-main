# RL.SYS Bootstrap

Institutional sprint execution now supports two modes.

Remote one-line mode:

bash <(curl -fsSL https://raw.githubusercontent.com/thiagocoder30/rlsys-terminal-main/main/install/bootstrap/rlsys-install.sh) sprint-056

Local alias mode:

./install/bootstrap/rlsys sprint-056

The local alias delegates to:

install/bootstrap/rlsys-install.sh

This avoids large copy/paste operations in Termux and keeps deployment repeatable.
