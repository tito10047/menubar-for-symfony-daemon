#!/bin/bash
#
# Removes the helper app installed by install.sh.
# Your actions.json is left alone.

set -euo pipefail

DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/menubar-for-symfony-daemon"
WRAPPER="$HOME/.local/bin/menubar-for-symfony-daemon"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/menubar-for-symfony"

if [ -x "$WRAPPER" ]; then
    "$WRAPPER" --uninstall-service
    rm -f "$WRAPPER"
    echo "Removed $WRAPPER"
fi

if [ -d "$DATA_DIR" ]; then
    rm -rf "$DATA_DIR"
    echo "Removed $DATA_DIR"
fi

if [ -f "$CONFIG_DIR/actions.json" ]; then
    echo "Kept your custom actions in $CONFIG_DIR/actions.json"
fi
