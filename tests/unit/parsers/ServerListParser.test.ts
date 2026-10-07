import { ServerListParser } from '../../../src/daemon/core/parsers/ServerListParser';

describe('ServerListParser', () => {
    let parser: ServerListParser;

    beforeEach(() => {
        parser = new ServerListParser();
    });

    it('should parse running and stopped servers from table output', () => {
        const output = `
+----------------------------+-------------+---------+
| Directory                  | Port        | Domains |
+----------------------------+-------------+---------+
| /home/user/project1        | 8000        |         |
| /home/user/project2        | Not running |         |
+----------------------------+-------------+---------+
`;
        const result = parser.parse(output);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            directory: '/home/user/project1',
            port: 8000,
            url: 'https://127.0.0.1:8000',
            isRunning: true,
        });
        expect(result[1]).toEqual({
            directory: '/home/user/project2',
            port: 8000,
            url: '',
            isRunning: false,
        });
    });

    it('should build URL from domain when present', () => {
        const output = `
+----------------------------+------+------------------+
| Directory                  | Port | Domains          |
+----------------------------+------+------------------+
| /home/user/myapp           | 8001 | myapp.wip        |
+----------------------------+------+------------------+
`;
        const result = parser.parse(output);

        expect(result).toHaveLength(1);
        expect(result[0].url).toBe('https://myapp.wip');
        expect(result[0].domain).toBe('myapp.wip');
    });

    it('should pick the same domain no matter how the CLI orders them', () => {
        // The CLI prints the domains of a project in a random order, so the
        // first printed row cannot be the one we report: it would make every
        // poll look like a state change.
        const oneOrder = `
+------------------+-------------+------------------+
| Directory        | Port        | Domains          |
+------------------+-------------+------------------+
| /home/user/app   | Not running | ts.app.wip       |
|                  |             | no.app.wip       |
|                  |             | app.wip          |
+------------------+-------------+------------------+
`;
        const otherOrder = `
+------------------+-------------+------------------+
| Directory        | Port        | Domains          |
+------------------+-------------+------------------+
| /home/user/app   | Not running | app.wip          |
|                  |             | ts.app.wip       |
|                  |             | no.app.wip       |
+------------------+-------------+------------------+
`;

        const first = parser.parse(oneOrder);
        const second = parser.parse(otherOrder);

        expect(first).toHaveLength(1);
        expect(first[0].domain).toBe('app.wip');
        expect(second).toEqual(first);
    });

    it('should build the URL of a running server from the same domain every time', () => {
        const output = `
+------------------+------+------------------+
| Directory        | Port | Domains          |
+------------------+------+------------------+
| /home/user/app   | 8001 | ts.app.wip       |
|                  |      | app.wip          |
+------------------+------+------------------+
`;
        const result = parser.parse(output);

        expect(result[0].url).toBe('https://app.wip');
    });

    it('should order servers by directory, whatever order the CLI used', () => {
        const output = `
+------------------+-------------+---------+
| Directory        | Port        | Domains |
+------------------+-------------+---------+
| /home/user/beta  | 8000        |         |
| /home/user/alpha | Not running |         |
+------------------+-------------+---------+
`;
        const result = parser.parse(output);

        expect(result.map(server => server.directory)).toEqual([
            '/home/user/alpha',
            '/home/user/beta',
        ]);
    });

    it('should return empty array on empty output', () => {
        expect(parser.parse('')).toEqual([]);
        expect(parser.parse('   ')).toEqual([]);
    });

    it('should skip header, separator, and invalid lines', () => {
        const output = `
+------------------+------+
| Directory        | Port |
+------------------+------+
`;
        expect(parser.parse(output)).toEqual([]);
    });
});
