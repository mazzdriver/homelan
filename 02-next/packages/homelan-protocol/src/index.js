export const PROTOCOL = 'homelan.rpc';
export const PROTOCOL_VERSION = 1;
export const CLIENT_VERSION = '2.1.0';
export const OPERATIONS = Object.freeze([
  'ping','inspect','plan','status','diagnose','lock','locknow','newpass','autologin',
  'locker.set','arm.set','poweroff','install','update'
]);
export const ERROR = Object.freeze({
  INVALID_REQUEST:'INVALID_REQUEST', UNSUPPORTED_VERSION:'UNSUPPORTED_VERSION',
  UNKNOWN_OPERATION:'UNKNOWN_OPERATION', PERMISSION_DENIED:'PERMISSION_DENIED',
  NOT_SUPPORTED:'NOT_SUPPORTED', PRECONDITION_FAILED:'PRECONDITION_FAILED',
  OPERATION_FAILED:'OPERATION_FAILED', PARTIAL_FAILURE:'PARTIAL_FAILURE'
});
export function request(operation, params = {}, id = cryptoRandomId()) {
  if (!OPERATIONS.includes(operation)) throw new TypeError(`Unsupported operation: ${operation}`);
  return { protocol: PROTOCOL, version: PROTOCOL_VERSION, id, operation, params };
}
export function success(req, result = {}) {
  return { protocol:PROTOCOL, version:PROTOCOL_VERSION, id:req.id, ok:true, result };
}
export function failure(req, code, message, details = undefined) {
  return { protocol:PROTOCOL, version:PROTOCOL_VERSION, id:req?.id ?? null, ok:false,
    error:{code,message,...(details===undefined?{}:{details})} };
}
export function validateRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Request must be an object';
  if (value.protocol !== PROTOCOL) return 'Unknown protocol';
  if (value.version !== PROTOCOL_VERSION) return 'Unsupported protocol version';
  if (typeof value.id !== 'string' || !value.id || value.id.length > 128) return 'Invalid request id';
  if (!OPERATIONS.includes(value.operation)) return 'Unknown operation';
  if (!value.params || typeof value.params !== 'object' || Array.isArray(value.params)) return 'params must be an object';
  return null;
}
function cryptoRandomId(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`; }

// ---- Capability negotiation and compatibility matrix (HOM-002) ----
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([1]);
export const MIN_CLIENT_VERSION = '2.0.0';
// Operations introduced after MIN_CLIENT_VERSION. Everything else needs only MIN_CLIENT_VERSION.
export const OPERATION_MIN_VERSION = Object.freeze({ inspect: '2.1.0', plan: '2.1.0' });
// Client capabilities an operation depends on. Single source of truth for Admin preflight and Client dispatch.
export const OPERATION_CAPABILITIES = Object.freeze({
  'locknow': Object.freeze(['sessionLock']),
  'newpass': Object.freeze(['accountManagement']),
  'lock': Object.freeze(['sessionLock', 'accountManagement']),
  'autologin': Object.freeze(['lightdmAutologin']),
  'locker.set': Object.freeze(['locker']),
  'arm.set': Object.freeze(['arm']),
  'poweroff': Object.freeze(['poweroff']),
  'install': Object.freeze(['arm'])
});
// Returns -1/0/1, or null when either value is not a dotted numeric version.
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(v ?? '').trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}
// Decide, from a client's `ping` result, whether `operation` may be sent to it. Pure; never fails open on unreadable data.
export function negotiate(ping, operation) {
  if (!OPERATIONS.includes(operation)) return { ok: false, code: ERROR.UNKNOWN_OPERATION, reason: `Unknown operation: ${operation}` };
  if (!ping || typeof ping !== 'object' || Array.isArray(ping)) return { ok: false, code: ERROR.UNSUPPORTED_VERSION, reason: 'Client returned no usable version information' };
  const protocols = Array.isArray(ping.supportedProtocolVersions) ? ping.supportedProtocolVersions : [ping.protocolVersion];
  if (!protocols.includes(PROTOCOL_VERSION)) return { ok: false, code: ERROR.UNSUPPORTED_VERSION, reason: `Client speaks protocol ${protocols.join(', ')}; Admin speaks ${PROTOCOL_VERSION}`, details: { clientProtocols: protocols, adminProtocol: PROTOCOL_VERSION } };
  const base = compareVersions(ping.clientVersion, MIN_CLIENT_VERSION);
  if (base === null) return { ok: false, code: ERROR.UNSUPPORTED_VERSION, reason: 'Client version is missing or unreadable' };
  if (base < 0) return { ok: false, code: ERROR.UNSUPPORTED_VERSION, reason: `Client ${ping.clientVersion} is older than the minimum supported ${MIN_CLIENT_VERSION}`, details: { clientVersion: ping.clientVersion, minimum: MIN_CLIENT_VERSION } };
  const needs = OPERATION_MIN_VERSION[operation];
  if (needs && compareVersions(ping.clientVersion, needs) < 0) return { ok: false, code: ERROR.UNSUPPORTED_VERSION, reason: `Operation ${operation} needs client ${needs} or newer; found ${ping.clientVersion}`, details: { clientVersion: ping.clientVersion, requires: needs } };
  const required = OPERATION_CAPABILITIES[operation] || [];
  if (ping.capabilities && typeof ping.capabilities === 'object') {
    const missing = required.filter((name) => ping.capabilities[name] !== true);
    if (missing.length) return { ok: false, code: ERROR.NOT_SUPPORTED, reason: `Client lacks required capability: ${missing.join(', ')}`, details: { missing, adapter: ping.adapter ?? null } };
    return { ok: true, capabilityCheck: 'verified' };
  }
  // Pre-2.1 clients do not report capabilities; they still enforce them locally.
  return { ok: true, capabilityCheck: required.length ? 'client-enforced' : 'not-required' };
}
export function compatibilityMatrix(ping) {
  return Object.fromEntries(OPERATIONS.map((operation) => [operation, negotiate(ping, operation)]));
}

// ---- Password policy for operator-chosen passwords (`newpass`) ----
// The default stays strict. An operator may lower the minimum length (down to 1) for their own household;
// generated passwords (`lock`, expiry resets) are always long and are not affected.
export const PASSWORD_MIN_DEFAULT = 12;
export const PASSWORD_MIN_FLOOR = 1;
export const PASSWORD_MAX = 256;
export function validatePasswordPolicy(password, minLength = PASSWORD_MIN_DEFAULT) {
  if (!Number.isInteger(minLength) || minLength < PASSWORD_MIN_FLOOR || minLength > PASSWORD_MAX) {
    return { ok: false, reason: `Minimum password length must be an integer from ${PASSWORD_MIN_FLOOR} to ${PASSWORD_MAX}` };
  }
  if (typeof password !== 'string' || password.length < minLength || password.length > PASSWORD_MAX || password.includes(':') || password.includes('\n') || password.includes('\0')) {
    return { ok: false, reason: `Password must be ${minLength}-${PASSWORD_MAX} characters and contain no colon or newline` };
  }
  return { ok: true };
}
