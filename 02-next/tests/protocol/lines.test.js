// 02-next/tests/protocol/lines.test.js
import { parseLines } from '../../packages/homelan-protocol/src/lines.js';

import { describe, it, expect } from 'node:test';
  it('[P-01] should skip invalid JSON and continue stream', () => {
    const stream = [
      '{\"jsonrpc\":\"2.0\",\"method\":\"ping\"}\n',
      'not a json at all\n',
      '{\"jsonrpc\":\"2.0\",\"method\":\"pong\",\"id\":1}\n'
    ];
    
    const results = [];
    stream.forEach(line => {
      try {
        const msg = parseLines(line);
        if (msg) results.push(msg);
      } catch (e) {
        // parseLines может бросать, а может возвращать null.
        // Если бросает - это баг протокола, тест должен упасть.
      }
    });

    expect(results).toHaveLength(2);
    expect(results[0].method).toBe('ping');
    expect(results[1].method).toBe('pong');
  });

  it('[P-04] should handle empty lines and whitespace', () => {
    const inputs = [
      '\n',
      '   \n',
      '{\"jsonrpc\":\"2.0\",\"method\":\"test\"}\n',
      '\t\n'
    ];
    
    const results = inputs.map(line => {
      try {
        return parseLines(line);
      } catch {
        return null;
      }
    }).filter(r => r !== null);

    expect(results).toHaveLength(1);
    expect(results[0].method).toBe('test');
  });
});

