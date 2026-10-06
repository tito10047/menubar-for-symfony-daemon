import { PhpVersion } from '../../../shared/dto/PhpVersion.js';

const DEFAULT_MARKERS = ['*', '⭐'];
const TABLE_BORDER_PREFIXES = ['─', '┌', '└', '├', '+', '-', '|-'];

/**
 * Parses the output of `symfony local:php:list`.
 *
 * The command prints a table followed by several paragraphs of advice that
 * mention version numbers ("create a .php-version file that contains the version
 * number (e.g. 8.5 or 8.5.10)"). Those paragraphs must not be scanned for
 * versions, which is why the table and the no-table cases are kept strictly
 * apart: once a header row has been found, only rows of that table are read.
 */
export class PhpListParser {
    parse(output: string): PhpVersion[] {
        if (!output || output.trim() === '') {
            return [];
        }

        const lines = output.split('\n');
        const columns = this._findColumns(lines);

        const versions: PhpVersion[] = [];
        for (const line of lines) {
            if (this._isNoise(line)) {
                continue;
            }

            const parsed = columns === null
                ? this._parseLooseLine(line.trim())
                : this._parseTableRow(line, columns);

            // A version with no binary path cannot be inspected or selected, so
            // reporting it would only put a dead entry in the menu.
            if (parsed === null || parsed.path === '') {
                continue;
            }

            if (!versions.some(known => known.version === parsed.version)) {
                versions.push(parsed);
            }
        }

        return versions;
    }

    private _findColumns(lines: string[]): TableColumns | null {
        const header = lines.find(line => line.includes('Version') && line.includes('Directory'));
        if (header === undefined) {
            return null;
        }

        const titles = header.split('|').map(part => part.trim());
        const version = titles.indexOf('Version');
        if (version === -1) {
            return null;
        }

        return {
            version,
            directory: titles.indexOf('Directory'),
            phpCli: titles.indexOf('PHP CLI'),
        };
    }

    private _isNoise(line: string): boolean {
        const trimmed = line.trim();
        return trimmed === ''
            || TABLE_BORDER_PREFIXES.some(prefix => trimmed.startsWith(prefix))
            || trimmed.includes('Version');
    }

    private _parseTableRow(line: string, columns: TableColumns): PhpVersion | null {
        if (!line.includes('|')) {
            return null;
        }

        const cells = line.split('|').map(cell => cell.trim());
        const versionCell = cells[columns.version];
        if (versionCell === undefined) {
            return null;
        }

        const version = versionCell.replace(/[*⭐]|\(default\)/g, '').trim();
        if (version === '') {
            return null;
        }

        const directory = columns.directory === -1 ? '' : (cells[columns.directory] ?? '');
        const phpCli = columns.phpCli === -1 ? '' : (cells[columns.phpCli] ?? '');

        return {
            version,
            path: joinPath(directory, phpCli),
            isDefault: isMarkedDefault(line),
        };
    }

    /** Fallback for output without a recognisable table, e.g. a future format. */
    private _parseLooseLine(trimmed: string): PhpVersion | null {
        const version = trimmed.match(/(\d+\.\d+(?:\.\d+)?)/);
        if (version === null) {
            return null;
        }

        const path = trimmed.match(/(\/[^\s│|]+)/);
        return {
            version: version[1],
            path: path === null ? '' : path[1],
            isDefault: isMarkedDefault(trimmed),
        };
    }
}

interface TableColumns {
    version: number;
    directory: number;
    phpCli: number;
}

function joinPath(directory: string, phpCli: string): string {
    if (directory !== '' && phpCli !== '') {
        return directory.endsWith('/') ? `${directory}${phpCli}` : `${directory}/${phpCli}`;
    }
    return directory !== '' ? directory : phpCli;
}

function isMarkedDefault(line: string): boolean {
    return DEFAULT_MARKERS.some(marker => line.includes(marker))
        || line.toLowerCase().includes('default');
}
