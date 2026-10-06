import { PhpInfoCommand } from '../../../src/daemon/core/commands/PhpInfoCommand';
import { PhpExtensionStatus } from '../../../src/shared/dto/PhpInfo';
import { ProcessRunnerInterface } from '../../../src/daemon/core/interfaces/ProcessRunnerInterface';
import { LoggerInterface } from '../../../src/shared/interfaces/LoggerInterface';

describe('PhpInfoCommand', () => {
    const PHP = '/usr/bin/php8.3';

    let mockProcessRunner: jest.Mocked<ProcessRunnerInterface>;
    let mockLogger: jest.Mocked<LoggerInterface>;
    let command: PhpInfoCommand;

    beforeEach(() => {
        mockProcessRunner = {
            run: jest.fn(),
            runBinary: jest.fn(),
        };
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };
        command = new PhpInfoCommand(mockProcessRunner);
        command.setLogger(mockLogger);
    });

    /** Answers the two calls the command makes, in order. */
    function respondWith(iniOutput: string, extensionOutput: string): void {
        mockProcessRunner.runBinary
            .mockResolvedValueOnce(iniOutput)
            .mockResolvedValueOnce(extensionOutput);
    }

    it('should have the correct name', () => {
        expect(command.getName()).toBe('php:info');
    });

    it('should inspect the binary it was given', async () => {
        respondWith('Loaded Configuration File: /etc/php.ini\n', 'xdebug:1:1\napcu:1:1\nopcache:0:0\n');

        const result = await command.execute([PHP]);

        expect(mockProcessRunner.runBinary).toHaveBeenCalledWith(PHP, ['--ini']);
        expect(mockProcessRunner.runBinary).toHaveBeenCalledWith(PHP, ['-r', expect.any(String)]);
        expect(result).toEqual({
            phpIniPath: '/etc/php.ini',
            xdebug: PhpExtensionStatus.ENABLED,
            apcu: PhpExtensionStatus.ENABLED,
            opcache: PhpExtensionStatus.NOT_INSTALLED,
        });
    });

    it('should never fall back to a PHP binary of its own choosing', async () => {
        await expect(command.execute([])).rejects.toThrow('requires the path to a PHP binary');
        await expect(command.execute([''])).rejects.toThrow('requires the path to a PHP binary');
        await expect(command.execute(['   '])).rejects.toThrow('requires the path to a PHP binary');
        expect(mockProcessRunner.runBinary).not.toHaveBeenCalled();
    });

    it('should prefer the loaded ini file over the configuration path', async () => {
        respondWith(
            [
                'Configuration File (php.ini) Path: /etc/php/8.3/cli',
                'Loaded Configuration File:         /etc/php/8.3/cli/php.ini',
                'Scan for additional .ini files in: /etc/php/8.3/cli/conf.d',
            ].join('\n'),
            '',
        );

        const result = await command.execute([PHP]);

        expect(result.phpIniPath).toBe('/etc/php/8.3/cli/php.ini');
    });

    it('should fall back to the configuration path when no ini file is loaded', async () => {
        respondWith(
            [
                'Configuration File (php.ini) Path: /usr/local/etc/php/7.4',
                'Loaded Configuration File:         (none)',
            ].join('\n'),
            '',
        );

        const result = await command.execute([PHP]);

        expect(result.phpIniPath).toBe('/usr/local/etc/php/7.4');
    });

    it('should report an extension whose .so exists but is not loaded as installed', async () => {
        respondWith('Loaded Configuration File: /etc/php.ini\n', 'xdebug:1:0\napcu:0:0\nopcache:1:0\n');

        const result = await command.execute([PHP]);

        expect(result.xdebug).toBe(PhpExtensionStatus.INSTALLED);
        expect(result.apcu).toBe(PhpExtensionStatus.NOT_INSTALLED);
        expect(result.opcache).toBe(PhpExtensionStatus.INSTALLED);
    });

    it('should report every extension as not installed when the output is empty', async () => {
        respondWith('Loaded Configuration File: /etc/php.ini\n', '');

        const result = await command.execute([PHP]);

        expect(result.xdebug).toBe(PhpExtensionStatus.NOT_INSTALLED);
        expect(result.apcu).toBe(PhpExtensionStatus.NOT_INSTALLED);
        expect(result.opcache).toBe(PhpExtensionStatus.NOT_INSTALLED);
    });

    it('should handle mixed states in the same output', async () => {
        respondWith('Loaded Configuration File: /etc/php.ini\n', 'xdebug:1:0\napcu:1:1\nopcache:0:0\n');

        const result = await command.execute([PHP]);

        expect(result.xdebug).toBe(PhpExtensionStatus.INSTALLED);
        expect(result.apcu).toBe(PhpExtensionStatus.ENABLED);
        expect(result.opcache).toBe(PhpExtensionStatus.NOT_INSTALLED);
    });

    it('should log and rethrow a failure of the underlying binary', async () => {
        const failure = new Error('php: command not found');
        mockProcessRunner.runBinary.mockRejectedValue(failure);

        await expect(command.execute([PHP])).rejects.toThrow(failure);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('php:info'), failure);
    });
});

describe('PhpInfoCommand against quoted --ini output', () => {
    // PHP 8.5 on Fedora quotes the paths it reports. Keeping the quotes made the
    // menu show `"/etc/php.ini"` and any consumer of the path open the wrong file.
    const QUOTED_INI = [
        'Configuration File (php.ini) Path: "/etc"',
        'Loaded Configuration File:         "/etc/php.ini"',
        'Scan for additional .ini files in: "/etc/php.d"',
        'Additional .ini files parsed:      /etc/php.d/10-opcache.ini,',
    ].join('\n');

    let runner: jest.Mocked<ProcessRunnerInterface>;

    beforeEach(() => {
        runner = { run: jest.fn(), runBinary: jest.fn() };
    });

    it('strips the quotes around the loaded ini path', async () => {
        runner.runBinary.mockResolvedValueOnce(QUOTED_INI).mockResolvedValueOnce('');

        const result = await new PhpInfoCommand(runner).execute(['/usr/bin/php']);

        expect(result.phpIniPath).toBe('/etc/php.ini');
    });

    it('strips the quotes when falling back to the configuration path', async () => {
        runner.runBinary
            .mockResolvedValueOnce('Configuration File (php.ini) Path: "/etc"\nLoaded Configuration File: (none)')
            .mockResolvedValueOnce('');

        const result = await new PhpInfoCommand(runner).execute(['/usr/bin/php']);

        expect(result.phpIniPath).toBe('/etc');
    });
});
