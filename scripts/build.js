/**
 * Bundles the daemon into a single readable file with esbuild.
 *
 *   dist/menubar-for-symfony-daemon.js
 *
 * One file is deliberate. This program is installed by hand from a tarball, so
 * the person installing it should be able to read all of it before running it —
 * nothing is minified and nothing is compiled to a binary.
 */

import { build, context } from 'esbuild';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

if (typeof version !== 'string' || version === '') {
    throw new Error('package.json is missing a "version" string');
}

/** Runtimes provided by GJS itself, which must never be bundled. */
const RUNTIME_MODULES = ['gi://*', 'system', 'gettext', 'cairo', 'console'];

const options = {
    entryPoints: ['src/daemon/main.ts'],
    outfile: 'dist/menubar-for-symfony-daemon.js',
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'esnext',
    charset: 'utf8',
    minify: false,
    external: RUNTIME_MODULES,
    define: {
        // Keeps package.json the single source of truth for the version.
        __DAEMON_VERSION__: JSON.stringify(version),
    },
    logLevel: 'info',
};

if (process.argv.includes('--watch')) {
    const ctx = await context(options);
    await ctx.watch();
    console.log(`Watching for changes (version ${version})...`);
} else {
    await build(options);
    console.log(`Built version ${version}`);
}
