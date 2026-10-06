import { PhpListParser } from '../../../src/daemon/core/parsers/PhpListParser';

describe('PhpListParser', () => {
    let parser: PhpListParser;

    beforeEach(() => {
        parser = new PhpListParser();
    });

    it('should parse box-style table output', () => {
        const output = `
┌─────────┬──────────────────────────────┬─────────┐
│ Version │ PHP CLI                      │ PHP-FPM │
├─────────┼──────────────────────────────┼─────────┤
│ 8.2.0   │ /usr/bin/php8.2              │         │
│ 8.1.0 * │ /usr/bin/php8.1              │         │
│ 7.4.33  │ /usr/local/bin/php7.4        │         │
└─────────┴──────────────────────────────┴─────────┘
`;
        const result = parser.parse(output);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({ version: '8.2.0', path: '/usr/bin/php8.2', isDefault: false });
        expect(result[1]).toEqual({ version: '8.1.0', path: '/usr/bin/php8.1', isDefault: true });
        expect(result[2]).toEqual({ version: '7.4.33', path: '/usr/local/bin/php7.4', isDefault: false });
    });

    it('should parse table with separate Directory and PHP CLI columns', () => {
        const output = `
+---------+--------------------------+---------+--------------+-------------+---------+---------+
| Version |        Directory         | PHP CLI |   PHP FPM    |   PHP CGI   | Server  | System? |
+---------+--------------------------+---------+--------------+-------------+---------+---------+
| 8.3.30  | /opt/remi/php83/root/usr | bin/php | sbin/php-fpm | bin/php-cgi | PHP FPM |         |
| 8.5.4   | /usr                     | bin/php | bin/php-fpm  |             | PHP FPM | *       |
+---------+--------------------------+---------+--------------+-------------+---------+---------+
`;
        const result = parser.parse(output);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ version: '8.3.30', path: '/opt/remi/php83/root/usr/bin/php', isDefault: false });
        expect(result[1]).toEqual({ version: '8.5.4', path: '/usr/bin/php', isDefault: true });
    });

    it('should detect default indicators: *, ⭐, (default)', () => {
        const output = `
  8.2.0 (default)  /usr/bin/php8.2
  8.1.0 ⭐         /usr/bin/php8.1
`;
        const result = parser.parse(output);

        expect(result).toHaveLength(2);
        expect(result[0].isDefault).toBe(true);
        expect(result[1].isDefault).toBe(true);
    });

    it('should deduplicate versions', () => {
        const output = `
| 8.2.0 | /usr/bin/php8.2 |
| 8.2.0 | /usr/bin/php8.2 |
`;
        const result = parser.parse(output);
        expect(result).toHaveLength(1);
    });

    it('should return empty array on empty output', () => {
        expect(parser.parse('')).toEqual([]);
    });
});

describe('PhpListParser with real Symfony CLI 5.20 output', () => {
    // Captured verbatim from `symfony local:php:list --no-ansi`. The trailing
    // prose is the point: it mentions version numbers, and an earlier
    // implementation scanned it with a regex fallback even though the table had
    // already been parsed, inventing a version with no binary path.
    const REAL_OUTPUT = [
        '+---------+--------------------------+---------+--------------+-------------+---------+---------+',
        '| Version | Directory                | PHP CLI | PHP FPM      | PHP CGI     | Server  | System  |',
        '+---------+--------------------------+---------+--------------+-------------+---------+---------+',
        '| 8.3.35  | /opt/remi/php83/root/usr | bin/php | sbin/php-fpm | bin/php-cgi | PHP FPM |         |',
        '| 8.4.26  | /opt/remi/php84/root/usr | bin/php | sbin/php-fpm | bin/php-cgi | PHP FPM |         |',
        '| 8.5.11  | /usr                     | bin/php | bin/php-fpm  | bin/php-cgi | PHP FPM | *       |',
        '+---------+--------------------------+---------+--------------+-------------+---------+---------+',
        '',
        'The current PHP version is selected from default version in $PATH',
        '',
        'To control the version used in a directory, create a .php-version file that contains the version number (e.g. 8.5 or 8.5.10),',
        'or define config.platform.php inside composer.json.',
        'If you\'re using Platform.sh or Upsun, the version can also be specified in their configuration files.',
        'To select a specific PHP installation, set SYMFONY_CLI_PHP_BINARY_PATH to its absolute PHP CLI path.',
    ].join('\n');

    it('reports exactly the installed versions, ignoring the trailing prose', () => {
        const versions = new PhpListParser().parse(REAL_OUTPUT);

        expect(versions).toEqual([
            { version: '8.3.35', path: '/opt/remi/php83/root/usr/bin/php', isDefault: false },
            { version: '8.4.26', path: '/opt/remi/php84/root/usr/bin/php', isDefault: false },
            { version: '8.5.11', path: '/usr/bin/php', isDefault: true },
        ]);
    });

    it('never reports a version without a binary path', () => {
        for (const version of new PhpListParser().parse(REAL_OUTPUT)) {
            expect(version.path).not.toBe('');
        }
    });
});
