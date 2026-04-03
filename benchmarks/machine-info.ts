import { execSync } from 'child_process';
import os from 'os';

export interface MachineInfo {
  os: string;
  cpu: string;
  cores: number;
  ram: string;
  bunVersion: string;
  nodeVersion: string;
  canvasVersion: string;
  puppeteerVersion: string;
  timestamp: string;
}

function getPackageVersion(pkg: string): string {
  try {
    const json = require(`${pkg}/package.json`);
    return json.version ?? 'unknown';
  } catch {
    try {
      const result = execSync(`bun pm ls 2>/dev/null | grep ${pkg}`, { encoding: 'utf-8' });
      const match = result.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

export function getMachineInfo(): MachineInfo {
  const ramGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(0);
  let bunVersion = 'unknown';
  try {
    bunVersion = execSync('bun --version', { encoding: 'utf-8' }).trim();
  } catch {}

  let nodeVersion = 'unknown';
  try {
    nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
  } catch {}

  return {
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cores: os.cpus().length,
    ram: `${ramGB} GB`,
    bunVersion,
    nodeVersion,
    canvasVersion: getPackageVersion('@napi-rs/canvas'),
    puppeteerVersion: getPackageVersion('puppeteer'),
    timestamp: new Date().toISOString(),
  };
}
