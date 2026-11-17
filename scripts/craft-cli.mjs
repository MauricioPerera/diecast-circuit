import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versions = { cadcraft: '0.20.1', materialcraft: '0.4.1', texturecraft: '0.6.1' };
export function craftCli(name) {
  const envName = `${name.toUpperCase()}_CLI`;
  if (process.env[envName]) return process.env[envName];
  const cached = join(process.env.LOCALAPPDATA || '', 'Temp', 'office-craft-tools', name,
    `${name}-${versions[name]}-windows-x64-portable`, `${name}-cli.exe`);
  return existsSync(cached) ? cached : `${name}-cli`;
}
export function run(name, ...args) {
  const result = spawnSync(craftCli(name), args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.error) throw result.error;
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  appendFileSync(join(root, 'artifacts', 'craft-build.log'),
    `\n${name} ${args.join(' ')}\n${result.stdout}${result.stderr}\nexit=${result.status}\n`);
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}
export function json(name, ...args) {
  const output = run(name, ...args);
  return output ? JSON.parse(output) : null;
}
