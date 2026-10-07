import { SymfonyServer } from '../../../shared/dto/SymfonyServer.js';

/** One parsed table row, before its continuation rows have been collected. */
interface ServerEntry {
    directory: string;
    port: number;
    isRunning: boolean;
    domains: string[];
}

/**
 * Turns `symfony server:list` table output into servers.
 *
 * The CLI prints the domains of a project in an unpredictable order, and a
 * project with several domains spills them over continuation rows. Both are
 * normalised here — the domains are sorted and the servers are ordered by
 * directory — so that two runs over an unchanged system produce byte-identical
 * output. `StateWatcher` compares snapshots to decide whether to notify the
 * extension, and a shuffled row would otherwise look like a state change on
 * every poll.
 */
export class ServerListParser {
    parse(output: string): SymfonyServer[] {
        if (!output || output.trim() === '') {
            return [];
        }

        const entries: ServerEntry[] = [];

        for (const line of output.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('+') || trimmed.startsWith('-') ||
                trimmed.includes('Directory') || !trimmed.includes('|')) {
                continue;
            }

            const columns = trimmed.split('|')
                .map(c => c.trim())
                .filter(c => c !== '');

            if (columns.length === 0) continue;

            // A row with a single column carries one more domain of the server
            // above it; the directory and port cells are blank.
            if (columns.length === 1) {
                entries[entries.length - 1]?.domains.push(columns[0]);
                continue;
            }

            const portStr = columns[1];
            let port = 8000;
            let isRunning = false;

            if (portStr.toLowerCase() !== 'not running') {
                const parsed = parseInt(portStr, 10);
                if (!isNaN(parsed)) {
                    port = parsed;
                    isRunning = true;
                }
            }

            entries.push({
                directory: columns[0],
                port,
                isRunning,
                domains: columns.length >= 3 && columns[2] ? [columns[2]] : [],
            });
        }

        return entries
            .map(entry => this._toServer(entry))
            .sort((a, b) => a.directory.localeCompare(b.directory));
    }

    private _toServer(entry: ServerEntry): SymfonyServer {
        // Lowest domain alphabetically, so the same one is reported every poll.
        const domain = [...entry.domains].sort((a, b) => a.localeCompare(b))[0];

        const url = entry.isRunning
            ? (domain ? `https://${domain}` : `https://127.0.0.1:${entry.port}`)
            : '';

        return {
            directory: entry.directory,
            port: entry.port,
            url,
            domain,
            isRunning: entry.isRunning,
        };
    }
}
