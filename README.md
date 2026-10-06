# symfony-menubar-daemon

> Helper service for the [Menubar for Symfony](https://github.com/tito10047/menubar-for-symfony)
> GNOME Shell extension.

This program runs the [Symfony CLI](https://symfony.com/download) on the
extension's behalf and publishes the results on the **session** D-Bus as
`com.github.tito10047.SymfonyMenubar`.

## Why it exists

The reviewers at [extensions.gnome.org](https://extensions.gnome.org) asked for the
subprocess handling to be moved out of the extension:

> There are too many spawn commands, which makes tracing the actual commands
> really hard for reviewers. You should move them out of this extension and
> create a separate app. Then, you can add that app as a dependency for this
> extension and they can communicate with each other over D-Bus.

So this is that app. The extension is now purely presentational: it starts no
processes and owns no main loop timers. Everything that touches the Symfony CLI
lives here.

## What it is, concretely

Plain JavaScript executed by `/usr/bin/gjs`. That interpreter is a hard
dependency of GNOME Shell itself — `gnome-shell` has `Depends: gjs` on
Debian/Ubuntu, and on Fedora it comes from the `gjs` package GNOME Shell requires
— so if you are running GNOME, you already have everything needed to run this.

- **Nothing is compiled.** The installed file is readable source you can inspect
  before running it. There is no binary to trust.
- **No extra dependencies.** No pip, no npm, no package manager.
- **Not a background service.** D-Bus starts it on demand and it exits again five
  minutes after the last client unsubscribes. It only polls the Symfony CLI while
  a client is actually subscribed.
- **Session bus, no privileges.** It never asks for root and never uses `pkexec`.

## Installation

```bash
tar -xzf symfony-menubar-daemon-1.3.0.tar.gz
cd symfony-menubar-daemon-1.3.0
./install.sh
```

Everything lands under your home directory:

| Path | Purpose |
|---|---|
| `~/.local/share/symfony-menubar-daemon/symfony-menubar-daemon.js` | the helper itself |
| `~/.local/bin/symfony-menubar-daemon` | launcher, for running it by hand |
| `~/.local/share/dbus-1/services/com.github.tito10047.SymfonyMenubar.service` | lets D-Bus start it on demand |

Remove it again with `./uninstall.sh`. Your `actions.json` is left alone.

### From source

```bash
git clone https://github.com/tito10047/symfony-menubar-daemon
cd symfony-menubar-daemon
npm install
npm run build
./install.sh
```

## Command line

```
symfony-menubar-daemon [OPTION...]

  --install-service     Register the service for D-Bus activation, then exit
  --uninstall-service   Remove that registration, then exit
  --replace             Take the bus name over from an already running instance
  --verbose             Log debug messages until a client configures logging
  --version             Print the version, then exit
  --help                Print this message, then exit
```

Running it by hand is only useful for debugging — normally D-Bus starts it.

## Poking at it directly

The interface is introspectable, so you do not need the extension to try it:

```bash
D="--session --dest com.github.tito10047.SymfonyMenubar \
   --object-path /com/github/tito10047/SymfonyMenubar"
I=com.github.tito10047.SymfonyMenubar1

gdbus introspect $D
gdbus call $D --method $I.ListServers
gdbus call $D --method $I.ListPhpVersions
gdbus call $D --method $I.GetProxyStatus
```

Methods that change state (`StartServer`, `StopProxy`, …) and the state-change
signals (`ServersChanged`, `ProxyChanged`, `PhpVersionsChanged`) are documented in
[`src/shared/dbus/protocol.ts`](src/shared/dbus/protocol.ts), which is the single
source of truth for the contract.

Failures come back as D-Bus errors — `…Error.CliNotFound`,
`…Error.CommandFailed`, `…Error.InvalidArgument`, `…Error.TerminalNotFound`,
`…Error.UnknownAction` — never as an empty result.

## Configuration

The helper reads no settings of its own. The extension owns them in GSettings and
forwards the relevant ones over `Subscribe` / `UpdateOptions`: polling interval,
debug logging, terminal command and an optional explicit Symfony CLI path.

The one file it does read is `~/.config/symfony-menubar/actions.json`, described in
the [extension's README](https://github.com/tito10047/menubar-for-symfony#custom-actions).

### Finding the Symfony CLI

Because the bus activates this process, it does **not** inherit your shell's
`PATH`. It looks for `symfony` in `PATH`, then in `~/.symfony5/bin`,
`~/.symfony/bin`, `~/.local/bin`, `/usr/local/bin` and `/usr/bin`. If your
installation is somewhere else, point the extension's `symfony-path` setting at it:

```bash
# The extension's schema is compiled into its own directory, not the system one
SCHEMA_DIR=~/.local/share/gnome-shell/extensions/menubar-for-symfony@tito10047.github.com/schemas
gsettings --schemadir "$SCHEMA_DIR" \
    set org.gnome.shell.extensions.symfony-menubar symfony-path /opt/symfony/bin/symfony
```

## Security notes

Two things are deliberate and worth stating plainly:

- **No shell is ever invoked.** Commands are always passed as an argv vector.
  Custom action commands are split into arguments *first* and `{path}` is
  substituted into the resulting elements *afterwards*, so a project directory
  containing spaces, quotes, `;` or `$(...)` cannot grow the vector or reach a
  shell. `tests/unit/shell/argv.test.ts` pins that behaviour down.
- **The extension never learns the commands.** `ListCustomActions` returns only
  id, name, icon and inline flag; running one happens here, by id.

## Development

```bash
npm run typecheck        # the quality gate
npm test                 # unit tests, fully mocked
npm run test:integration # against the real Symfony CLI (RUN_INTEGRATION=1)
npm run test:dbus        # end-to-end on a private session bus via dbus-run-session
npm run check            # all of the above, in order
npm run build            # -> dist/symfony-menubar-daemon.js
npm run watch            # rebuild on change
```

`npm run test:dbus` is the important one: it starts the built daemon under
`dbus-run-session` and drives it with `gdbus`, covering the exported interface,
variant marshalling in both directions, error mapping, signal delivery and the
service file installer. None of that can run under Node, because the `@girs`
packages are type definitions only.

### The shared contract

`src/shared/` is mirrored between this repository and the extension's. Both sides
compile the same `protocol.ts`, `wire.ts` and `variant.ts`, which is what keeps
the D-Bus interface, its field names and its marshalling from drifting apart.

After changing anything under `src/shared/`, copy it to the other repository and
bump `API_VERSION` in `protocol.ts` if the change is incompatible. At runtime the
extension compares `API_VERSION` with the daemon's and tells the user to update
the helper rather than failing in obscure ways. To check for drift:

```bash
scripts/check-shared.sh ../menubar-for-symfony
```

## License

Released by [Jozef Môstka](https://vsetkosada.sk/en) under the
[GNU General Public License v2.0 or later](LICENSE) (GPL-2.0-or-later).
