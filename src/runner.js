import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';

const COLORS = {
  primary: '#22C55E',
  secondary: '#3B82F6',
  accent: '#F59E0B',
  muted: '#6B7280',
};

const LOCK_FILES = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'package-lock.json': 'npm',
  'bun.lockb': 'bun',
};

export function detectPackageManager(directory) {
  for (const [lockFile, pm] of Object.entries(LOCK_FILES)) {
    if (existsSync(join(directory, lockFile))) {
      return pm;
    }
  }
  return 'npm';
}

export function getScriptCommand(scriptName, directory) {
  const packageManager = detectPackageManager(directory);
  return `${packageManager} run ${scriptName}`;
}

export function runScript(scriptName, directory) {
  return new Promise((resolve, reject) => {
    const packageManager = detectPackageManager(directory);

    console.log('');
    console.log(
      chalk.hex(COLORS.muted)('─'.repeat(75))
    );
    console.log(
      `  ${chalk.hex(COLORS.secondary)('Running:')} ${chalk.hex(COLORS.primary).bold(scriptName)} ${chalk.hex(COLORS.muted)('via')} ${chalk.hex(COLORS.accent)(packageManager)}`
    );
    console.log(
      chalk.hex(COLORS.muted)('─'.repeat(75))
    );
    console.log('');

    const child = spawn(packageManager, ['run', scriptName], {
      cwd: directory,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      console.log('');
      console.log(
        chalk.hex(COLORS.muted)('─'.repeat(75))
      );

      if (code === 0) {
        console.log(
          `  ${chalk.hex(COLORS.primary)('✔')} Script finished successfully`
        );
      } else {
        console.log(
          `  ${chalk.hex('#EF4444')('✖')} Script exited with code ${code}`
        );
      }

      console.log(
        chalk.hex(COLORS.muted)('─'.repeat(75))
      );

      resolve(code);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

const MAX_LOG_LINES = 100;

export function runScriptBackground(scriptName, directory) {
  const packageManager = detectPackageManager(directory);
  const logs = [];

  const child = spawn(packageManager, ['run', scriptName], {
    cwd: directory,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const addLog = (data, type) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
      logs.push({ time: new Date(), type, text: line });
      if (logs.length > MAX_LOG_LINES) logs.shift();
    }
  };

  child.stdout.on('data', (data) => addLog(data, 'stdout'));
  child.stderr.on('data', (data) => addLog(data, 'stderr'));

  child.unref();

  return { pid: child.pid, logs, child };
}

export function killProcess(pid) {
  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

export function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text) {
  const platform = process.platform;

  let command;
  if (platform === 'darwin') {
    command = 'pbcopy';
  } else if (platform === 'linux') {
    command = 'xclip -selection clipboard';
  } else if (platform === 'win32') {
    command = 'clip';
  } else {
    throw new Error('Clipboard not supported on this platform');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'ignore', 'ignore'],
    });

    child.stdin.write(text);
    child.stdin.end();

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Failed to copy to clipboard'));
      }
    });

    child.on('error', reject);
  });
}
