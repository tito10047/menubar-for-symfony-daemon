import { ProxyStatusParser } from '../../../src/daemon/core/parsers/ProxyStatusParser';

describe('ProxyStatusParser', () => {
    let parser: ProxyStatusParser;

    beforeEach(() => {
        parser = new ProxyStatusParser();
    });

    it('should detect running proxy with domain entries', () => {
        const output = `
Listening on https://127.0.0.1:7080
+--------------+--------------------------+
| Domain       | Directory                |
+--------------+--------------------------+
| myapp.wip    | /home/user/myapp         |
| other.wip    | /home/user/other         |
+--------------+--------------------------+
`;
        const result = parser.parse(output);

        expect(result.isRunning).toBe(true);
        expect(result.proxies).toHaveLength(2);
        expect(result.proxies[0]).toEqual({ domain: 'myapp.wip', directory: '/home/user/myapp' });
        expect(result.proxies[1]).toEqual({ domain: 'other.wip', directory: '/home/user/other' });
    });

    it('should return not running when output contains "not running"', () => {
        const output = `
Proxy server is not running.
`;
        const result = parser.parse(output);

        expect(result.isRunning).toBe(false);
        expect(result.proxies).toHaveLength(0);
    });

    it('should return not running on empty output', () => {
        expect(parser.parse('')).toEqual({ isRunning: false, proxies: [] });
    });

    it('should report the same list no matter how the CLI ordered the domains', () => {
        // Same reason as in ServerListParser: the CLI shuffles the domains of a
        // project, and a reshuffled snapshot must not look like a state change.
        const oneOrder = `
Listening on https://127.0.0.1:7080
+------------------+--------------------+
| Directory        | Domains            |
+------------------+--------------------+
| /home/user/app   | ts.app.wip         |
|                  | app.wip            |
| /home/user/other | other.wip          |
+------------------+--------------------+
`;
        const otherOrder = `
Listening on https://127.0.0.1:7080
+------------------+--------------------+
| Directory        | Domains            |
+------------------+--------------------+
| /home/user/other | other.wip          |
| /home/user/app   | app.wip            |
|                  | ts.app.wip         |
+------------------+--------------------+
`;

        expect(parser.parse(oneOrder).proxies).toEqual(parser.parse(otherOrder).proxies);
    });

    it('should attach a continuation domain to the directory above it', () => {
        const output = `
Listening on https://127.0.0.1:7080
+------------------+--------------------+
| Directory        | Domains            |
+------------------+--------------------+
| /home/user/app   | app.wip            |
|                  | ts.app.wip         |
+------------------+--------------------+
`;
        const result = parser.parse(output);

        expect(result.proxies).toEqual([
            { domain: 'app.wip', directory: '/home/user/app' },
            { domain: 'ts.app.wip', directory: '/home/user/app' },
        ]);
    });

    it('should deduplicate domains', () => {
        const output = `
Listening on https://127.0.0.1:7080
| myapp.wip | /home/user/myapp |
| myapp.wip | /home/user/myapp |
`;
        const result = parser.parse(output);
        expect(result.proxies).toHaveLength(1);
    });
});
