// 02-next/tests/client/platform.windows.test.js
const { inspect, plan } = require('../../packages/homelan-client/src/index.js');
const os = require('os');

// Мокаем ОС как Windows
jest.mock('os', () => ({
  platform: () => 'win32',
  release: () => '10.0.22631',
  arch: () => 'x64'
}));

// Мокаем fs для проверки планов (если они пишутся в файл)
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  writeFileSync: jest.fn()
}));

describe('Client Platform Detection - Windows (C-03, C-04)', () => {
  it('should identify win32 platform and empty capabilities', async () => {
    const result = await inspect();
    expect(result.platform).toBe('win32');
    expect(result.adapter).toBeNull();
    expect(result.capabilities).toEqual([]);
  });

  it('client plan should refuse unsupported platform', async () => {
    await expect(plan()).rejects.toThrow('Unsupported platform adapter');
  });
});

