import {negotiate} from './protocol.js';

export class PreflightError extends Error {
  constructor(check, operation, deviceId) {
    super(`${deviceId}: ${operation} not sent — ${check.reason}`);
    this.code = check.code; this.details = check.details; this.deviceId = deviceId; this.operation = operation;
  }
}

// Ask the client what it can do and decide whether `operation` may be sent. `invokeFn` is injected so tests never need SSH.
export async function preflight(invokeFn, device, cfg, operation, options = {}) {
  if (operation === 'ping') return { ok: true, capabilityCheck: 'not-required' };
  const response = await invokeFn(device, cfg, 'ping', {}, options);
  if (!response?.ok) return { ok: false, code: response?.error?.code ?? 'OPERATION_FAILED', reason: `Client ping failed: ${response?.error?.message ?? 'no response'}` };
  return negotiate(response.result, operation);
}

// Preflight, then send. The real operation (and any secret in params) is never transmitted if the check fails.
export async function guardedInvoke(invokeFn, device, cfg, operation, params = {}, options = {}) {
  const check = await preflight(invokeFn, device, cfg, operation, options);
  if (!check.ok) throw new PreflightError(check, operation, device.id);
  return invokeFn(device, cfg, operation, params, options);
}
