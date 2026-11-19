// 02-next/tests/setupTests.js
// Глобальные моки для изоляции от сети и ФС

// Мок для ssh2 (транспорт Admin)
jest.mock('ssh2', () => {
  return {
    Client: jest.fn(() => ({
      on: jest.fn(),
      connect: jest.fn((cfg, cb) => {
        // Симуляция успеха по умолчанию
        if (cfg.id === 'fail-connect') {
          return cb(new Error('ECONNREFUSED'));
        }
        if (cfg.id === 'fail-hostkey') {
          return cb({ level: 'client-authentication', description: 'Host key verification failed' });
        }
        return cb();
      }),
      exec: jest.fn((cmd, opts, cb) => {
        const stream = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              // Мокируем ответы CLI клиента
              if (cmd.includes('homelan-client inspect')) {
                handler(JSON.stringify({
                  platform: 'linux',
                  distro: 'ubuntu',
                  version: '22.04',
                  init: 'systemd',
                  package_manager: 'apt',
                  capabilities: ['lock-screen', 'poweroff', 'autologin']
                }));
              } else if (cmd.includes('homelan-client plan')) {
                handler(JSON.stringify({ packages: ['light-locker', 'accountsservice'], reboot: false }));
              }
              handler(null); // EOF
            }
          }),
          end: jest.fn()
        };
        return cb(null, stream);
      }),
      end: jest.fn()
    }))
  };
});

// Мок для child_process (адаптеры Client)
const originalExecFile = jest.requireActual('child_process').execFile;
jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    // systemctl
    if (file === 'systemctl') {
      if (args.includes('is-active')) {
        return callback(null, { stdout: 'active\n' });
      }
      if (args.includes('start')) {
        return callback(null);
      }
    }
    // loginctl
    if (file === 'loginctl') {
      if (args.includes('lock-session')) {
        return callback(null);
      }
    }
    // uname
    if (file === 'uname') {
      if (args.includes('-s')) {
        return callback(null, { stdout: 'Linux\n' });
      }
    }
    // Win32 fallback
    return callback(new Error('ENOENT: no such file or directory'));
  })
}));

