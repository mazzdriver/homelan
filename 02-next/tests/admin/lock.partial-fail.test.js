import { execSync } from 'child_process';
import path from 'path';

// Перезатираем глобальный мок из setupTests.js для этого файла
// чтобы симулировать частичный отказ
import { Client } from 'ssh2';

const { mock } = await import('node:test');

mock.method(Client.prototype, 'on', jest.fn());
mock.method(Client.prototype, 'connect', jest.fn((cfg, cb) => cb()));
mock.method(Client.prototype, 'exec', jest.fn((cmd, opts, cb) => {
    const stream = {
        on: jest.fn((event, handler) => {
            if (event === 'data') {
                if (cmd.includes('newpass')) {
                    // device-3 упадет на этапе newpass
                    if (cmd.includes('device-3')) {
                        handler(JSON.stringify({ error: 'ERR_CHILD_PROCESS_FAIL' }));
                    } else {
                        handler(JSON.stringify({ password: 'temp-123' }));
                    }
                    handler(null);
                }
            }
        }),
        end: jest.fn()
    };
    cb(null, stream);
}));
mock.method(Client.prototype, 'end', jest.fn());

describe('homelan lock -- partial failure (A-05)', () => {
    it('should fail overall if one device fails to reset password', () => {
        const bin = path.resolve('../../packages/homelan-admin/bin/homelan.js');
        
        // Мокаем реестр устройств
        mock.method(
            '../../packages/homelan-admin/src/device-registry.js', 
            'loadRegistry', 
            jest.fn(() => ({
                'device-1': { address: '10.0.0.1', user: 'p' },
                'device-2': { address: '10.0.0.2', user: 'p' },
                'device-3': { address: '10.0.0.3', user: 'p' }
            })
        );
        mock.method(
            '../../packages/homelan-admin/src/device-registry.js', 
            'saveRegistry', 
            jest.fn()
        );
        
        try {
            execSync(`node "${bin}" lock device-1,device-2,device-3 --user child`, { encoding: 'utf-8' });
        } catch (err) {
            expect(err.status).toBe(1);
        }
        
        const registry = require('../../packages/homelan-admin/src/device-registry.js');
        // Операция должна быть атомарной: если один упал, пароли не сбрасываются нигде
        expect(registry.saveRegistry).not.toHaveBeenCalled();
    });
});
