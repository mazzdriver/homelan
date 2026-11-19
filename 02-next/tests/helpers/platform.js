// Skip reasons for tests that exercise POSIX shell scripts. `false` means "run".
export const POSIX_ONLY = process.platform === 'win32' ? 'requires a POSIX shell (sh)' : false;
export const LINUX_ONLY = process.platform === 'linux' ? false : 'Linux bootstrap only reports facts.os=linux on Linux';
