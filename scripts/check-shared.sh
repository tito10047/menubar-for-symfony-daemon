#!/bin/bash
#
# Reports drift in the shared D-Bus contract.
#
# src/shared/ is mirrored between this repository and the extension's. Both sides
# compile the same protocol, wire shapes and marshalling, so the two copies must
# stay byte-identical — a silent divergence would break the bus at runtime rather
# than at build time.
#
# Usage: scripts/check-shared.sh /path/to/menubar-for-symfony

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $(basename "$0") /path/to/menubar-for-symfony" >&2
    exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OTHER="$1"

MINE="$HERE/src/shared"
THEIRS="$OTHER/src/shared"

if [ ! -d "$THEIRS" ]; then
    echo "Error: $THEIRS does not exist. Is '$OTHER' the extension checkout?" >&2
    exit 1
fi

if diff -ru "$MINE" "$THEIRS"; then
    echo "src/shared is identical in both repositories."
    exit 0
fi

echo >&2
echo "src/shared has drifted. Copy the intended version across, and bump" >&2
echo "API_VERSION in src/shared/dbus/protocol.ts if the change is incompatible." >&2
exit 1
