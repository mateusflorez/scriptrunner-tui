import chalk from 'chalk';
import { select, Separator } from '@inquirer/prompts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const COLORS = {
  primary: '#22C55E',
  secondary: '#3B82F6',
  accent: '#F59E0B',
  danger: '#EF4444',
  muted: '#6B7280',
  purple: '#A855F7',
};

const SCRIPT_PATTERNS = {
  dev: { patterns: ['dev', 'start', 'serve', 'watch'], color: 'primary' },
  test: { patterns: ['test', 'spec', 'e2e', 'coverage'], color: 'secondary' },
  build: { patterns: ['build', 'compile', 'bundle', 'dist'], color: 'accent' },
  lint: { patterns: ['lint', 'format', 'prettier', 'eslint', 'check'], color: 'purple' },
};

function getScriptColor(scriptName) {
  const lowerName = scriptName.toLowerCase();

  for (const { patterns, color } of Object.values(SCRIPT_PATTERNS)) {
    if (patterns.some(p => lowerName.includes(p))) {
      return COLORS[color];
    }
  }

  return COLORS.muted;
}

export function clearScreen() {
  console.clear();
}

const ASCII_HEADER = `
┌────────────────────────────────────────────────────────────┐
│   ___         _      _   ___                               │
│  / __| __ _ _(_)_ __| |_| _ \\_  _ _ _  _ _  ___ _ _        │
│  \\__ \\/ _| '_| | '_ \\  _|   / || | ' \\| ' \\/ -_) '_|       │
│  |___/\\__|_| |_| .__/\\__|_|_\\_,_|_||_|_||_\\___|_|          │
│                |_|                                         │
└────────────────────────────────────────────────────────────┘`;

export function showHeader(projectName) {
  console.log(chalk.hex(COLORS.primary)(ASCII_HEADER));
  console.log('');
  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );
  console.log(
    `  ${chalk.hex(COLORS.secondary)('ScriptRunner')} ${chalk.hex(COLORS.muted)(`v${version}`)}  ${chalk.hex(COLORS.muted)('|')}  ${chalk.hex(COLORS.accent)(projectName)}`
  );
  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );
  console.log('');
}

export async function showScriptMenu(scripts, descriptions = {}, backgroundProcesses = []) {
  const scriptEntries = Object.entries(scripts);

  const choices = [
    ...scriptEntries.map(([name, command]) => {
      const desc = descriptions[name];
      const descText = desc ? `  ${chalk.hex(COLORS.muted).italic(`# ${desc}`)}` : '';
      return {
        name: `${chalk.hex(getScriptColor(name)).bold(name.padEnd(15))} ${chalk.hex(COLORS.muted)('→')} ${chalk.hex(COLORS.muted)(command)}${descText}`,
        value: name,
      };
    }),
    new Separator(chalk.hex(COLORS.muted)('─'.repeat(40))),
    ...backgroundProcesses.map(proc => ({
      name: `${chalk.hex(COLORS.secondary)('⚡')} ${chalk.hex(COLORS.accent)(proc.name.padEnd(14))} ${chalk.hex(COLORS.muted)(`PID: ${proc.pid}`)}`,
      value: { type: 'background', ...proc },
    })),
    ...(backgroundProcesses.length > 0
      ? [new Separator(chalk.hex(COLORS.muted)('─'.repeat(40)))]
      : []),
    { name: chalk.hex(COLORS.danger)('Exit'), value: 'exit' },
  ];

  const answer = await select({
    message: 'Select script to run:',
    choices,
    loop: true,
  });

  return answer;
}

export async function showExecutionOptions(scriptName, isFavorited = false) {
  const favoriteLabel = isFavorited
    ? `${chalk.hex(COLORS.accent)('★ Remove favorite')}    ${chalk.hex(COLORS.muted)('→ Remove dos favoritos')}`
    : `${chalk.hex(COLORS.accent)('☆ Add favorite')}       ${chalk.hex(COLORS.muted)('→ Adiciona aos favoritos')}`;

  const choices = [
    {
      name: `${chalk.hex(COLORS.primary)('Run (interactive)')}     ${chalk.hex(COLORS.muted)('→ Output visível, Ctrl+C para parar')}`,
      value: 'interactive',
    },
    {
      name: `${chalk.hex(COLORS.secondary)('Run (background)')}      ${chalk.hex(COLORS.muted)('→ Executa em background')}`,
      value: 'background',
    },
    {
      name: `${chalk.hex(COLORS.accent)('Copy command')}          ${chalk.hex(COLORS.muted)('→ Copia comando para clipboard')}`,
      value: 'copy',
    },
    {
      name: favoriteLabel,
      value: 'favorite',
    },
    new Separator(chalk.hex(COLORS.muted)('─'.repeat(40))),
    { name: chalk.hex(COLORS.muted)('Back'), value: 'back' },
  ];

  const answer = await select({
    message: `How do you want to run "${chalk.hex(COLORS.primary)(scriptName)}"?`,
    choices,
    loop: true,
  });

  return answer;
}

export async function showBackgroundProcessOptions(processInfo) {
  const logCount = processInfo.logs?.length || 0;

  const choices = [
    {
      name: `${chalk.hex(COLORS.secondary)('View logs')}           ${chalk.hex(COLORS.muted)(`→ ${logCount} linha(s) capturada(s)`)}`,
      value: 'logs',
    },
    {
      name: `${chalk.hex(COLORS.danger)('Kill process')}         ${chalk.hex(COLORS.muted)('→ Encerra o processo')}`,
      value: 'kill',
    },
    new Separator(chalk.hex(COLORS.muted)('─'.repeat(40))),
    { name: chalk.hex(COLORS.muted)('Back'), value: 'back' },
  ];

  const answer = await select({
    message: `Process "${chalk.hex(COLORS.accent)(processInfo.name)}" (PID: ${processInfo.pid}):`,
    choices,
    loop: true,
  });

  return answer;
}

export async function showLogs(processInfo, maxLines = 30) {
  const logs = processInfo.logs || [];

  console.log('');
  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );
  console.log(
    `  ${chalk.hex(COLORS.secondary)('Logs:')} ${chalk.hex(COLORS.accent)(processInfo.name)} ${chalk.hex(COLORS.muted)(`(PID: ${processInfo.pid})`)}`
  );
  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );

  if (logs.length === 0) {
    console.log(chalk.hex(COLORS.muted)('  (nenhum log capturado)'));
  } else {
    const recentLogs = logs.slice(-maxLines);
    for (const log of recentLogs) {
      const time = log.time.toLocaleTimeString('pt-BR');
      const prefix = log.type === 'stderr'
        ? chalk.hex(COLORS.danger)('ERR')
        : chalk.hex(COLORS.muted)('OUT');
      console.log(`  ${chalk.hex(COLORS.muted)(time)} ${prefix} ${log.text}`);
    }

    if (logs.length > maxLines) {
      console.log(chalk.hex(COLORS.muted)(`  ... ${logs.length - maxLines} linhas anteriores omitidas`));
    }
  }

  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );
  console.log('');

  await select({
    message: '',
    choices: [{ name: chalk.hex(COLORS.muted)('Back'), value: 'back' }],
  });
}

export function showError(message) {
  console.log(chalk.hex(COLORS.danger)(`\n  ✖ ${message}\n`));
}

export function showSuccess(message) {
  console.log(chalk.hex(COLORS.primary)(`\n  ✔ ${message}\n`));
}

export function showInfo(message) {
  console.log(chalk.hex(COLORS.secondary)(`\n  ℹ ${message}\n`));
}

export function showWarning(message) {
  console.log(chalk.hex(COLORS.accent)(`\n  ⚠ ${message}\n`));
}

export async function showScriptMenuWithHistory(scripts, descriptions = {}, backgroundProcesses = [], recentScripts = [], favorites = []) {
  const scriptEntries = Object.entries(scripts);
  const choices = [];

  const favoriteNames = new Set(favorites.map(f => f.script));
  const recentNames = new Set(recentScripts.map(r => r.script));

  // Sort: favorites first, then recent (non-favorite), then alphabetical
  const sortedScripts = scriptEntries.sort(([a], [b]) => {
    const aFav = favoriteNames.has(a);
    const bFav = favoriteNames.has(b);
    const aRecent = recentNames.has(a) && !aFav;
    const bRecent = recentNames.has(b) && !bFav;

    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    return a.localeCompare(b);
  });

  // Single unified list
  for (const [name, command] of sortedScripts) {
    const desc = descriptions[name];
    const descText = desc ? `  ${chalk.hex(COLORS.muted).italic(`# ${desc}`)}` : '';

    let icon = '  ';
    if (favoriteNames.has(name)) {
      icon = chalk.hex(COLORS.accent)('★ ');
    } else if (recentNames.has(name)) {
      icon = chalk.hex(COLORS.muted)('↻ ');
    }

    choices.push({
      name: `${icon}${chalk.hex(getScriptColor(name)).bold(name.padEnd(14))} ${chalk.hex(COLORS.muted)('→')} ${chalk.hex(COLORS.muted)(command)}${descText}`,
      value: name,
    });
  }

  // Background processes
  if (backgroundProcesses.length > 0) {
    choices.push(new Separator(chalk.hex(COLORS.muted)('─'.repeat(40))));
    for (const proc of backgroundProcesses) {
      choices.push({
        name: `${chalk.hex(COLORS.secondary)('⚡')} ${chalk.hex(COLORS.accent)(proc.name.padEnd(14))} ${chalk.hex(COLORS.muted)(`PID: ${proc.pid}`)}`,
        value: { type: 'background', ...proc },
      });
    }
  }

  choices.push(new Separator(chalk.hex(COLORS.muted)('─'.repeat(40))));
  choices.push({ name: chalk.hex(COLORS.danger)('Exit'), value: 'exit' });

  return await select({
    message: 'Select script to run:',
    choices,
    loop: true,
  });
}

export async function showWorkspaceMenu(workspaces, rootProjectName) {
  const choices = [
    {
      name: `${chalk.hex(COLORS.primary).bold('⌂ Root')}  ${chalk.hex(COLORS.muted)('→')} ${chalk.hex(COLORS.accent)(rootProjectName)}`,
      value: 'root',
    },
    new Separator(chalk.hex(COLORS.muted)(' Workspaces')),
    ...workspaces.map(ws => ({
      name: `${chalk.hex(COLORS.secondary).bold(ws.name.padEnd(20))} ${chalk.hex(COLORS.muted)('→')} ${chalk.hex(COLORS.muted)(ws.relativePath)}`,
      value: ws,
    })),
    new Separator(chalk.hex(COLORS.muted)('─'.repeat(40))),
    { name: chalk.hex(COLORS.danger)('Exit'), value: 'exit' },
  ];

  const answer = await select({
    message: 'Select workspace:',
    choices,
    loop: true,
  });

  return answer;
}

export function showMonorepoHeader(projectName, workspaceName) {
  console.log(chalk.hex(COLORS.primary)(ASCII_HEADER));
  console.log('');
  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );
  console.log(
    `  ${chalk.hex(COLORS.secondary)('ScriptRunner')} ${chalk.hex(COLORS.muted)(`v${version}`)}  ${chalk.hex(COLORS.muted)('|')}  ${chalk.hex(COLORS.accent)(projectName)} ${chalk.hex(COLORS.muted)('→')} ${chalk.hex(COLORS.primary)(workspaceName)}`
  );
  console.log(
    chalk.hex(COLORS.muted)('─'.repeat(75))
  );
  console.log('');
}
