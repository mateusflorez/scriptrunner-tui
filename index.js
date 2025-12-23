#!/usr/bin/env node

import { parsePackageJson } from './src/parser.js';
import { showHeader, showScriptMenu, showExecutionOptions, showBackgroundProcessOptions, showError, showSuccess, showInfo, showLogs, clearScreen } from './src/ui.js';
import { runScript, runScriptBackground, getScriptCommand, copyToClipboard, killProcess, isProcessRunning } from './src/runner.js';

const backgroundProcesses = [];

const HELP_TEXT = `
ScriptRunner - TUI for running package.json scripts

Usage:
  scriptrunner [options] [script-name]
  sr [options] [script-name]

Options:
  -d, --directory <path>  Specify project directory
  -l, --list              List scripts without running
  -h, --help              Show this help message
  -v, --version           Show version

Examples:
  scriptrunner              # Interactive mode in current directory
  scriptrunner dev          # Run 'dev' script directly
  scriptrunner -d ./myapp   # Use different directory
  scriptrunner -l           # List available scripts
`;

function parseArgs(args) {
  const options = {
    directory: process.cwd(),
    list: false,
    help: false,
    version: false,
    scriptName: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
    } else if (arg === '-l' || arg === '--list') {
      options.list = true;
    } else if (arg === '-d' || arg === '--directory') {
      options.directory = args[++i];
    } else if (!arg.startsWith('-')) {
      options.scriptName = arg;
    }
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.version) {
    const { default: pkg } = await import('./package.json', { with: { type: 'json' } });
    console.log(`ScriptRunner v${pkg.version}`);
    process.exit(0);
  }

  try {
    const { scripts, scriptsDescriptions, projectName } = await parsePackageJson(options.directory);

    if (Object.keys(scripts).length === 0) {
      showError('Nenhum script encontrado no package.json');
      process.exit(1);
    }

    showHeader(projectName);

    if (options.list) {
      console.log('\nScripts disponíveis:\n');
      for (const [name, command] of Object.entries(scripts)) {
        const desc = scriptsDescriptions[name];
        const descText = desc ? `  # ${desc}` : '';
        console.log(`  ${name} → ${command}${descText}`);
      }
      process.exit(0);
    }

    if (options.scriptName) {
      if (!scripts[options.scriptName]) {
        showError(`Script "${options.scriptName}" não encontrado`);
        process.exit(1);
      }
      await runScript(options.scriptName, options.directory);
      process.exit(0);
    }

    // Interactive mode
    let needsRefresh = false;

    while (true) {
      // Filter out dead processes
      const activeProcesses = backgroundProcesses.filter(p => isProcessRunning(p.pid));
      backgroundProcesses.length = 0;
      backgroundProcesses.push(...activeProcesses);

      // Refresh screen if needed
      if (needsRefresh) {
        clearScreen();
        showHeader(projectName);
        needsRefresh = false;
      }

      const selected = await showScriptMenu(scripts, scriptsDescriptions, backgroundProcesses);

      if (selected === 'exit') {
        if (backgroundProcesses.length > 0) {
          showInfo(`${backgroundProcesses.length} processo(s) em background continuarão rodando.`);
        }
        showSuccess('Até mais!');
        break;
      }

      // Handle background process selection
      if (typeof selected === 'object' && selected.type === 'background') {
        const proc = backgroundProcesses.find(p => p.pid === selected.pid);

        while (true) {
          clearScreen();
          showHeader(projectName);

          const procOption = await showBackgroundProcessOptions(proc || selected);

          if (procOption === 'logs' && proc) {
            clearScreen();
            showHeader(projectName);
            await showLogs(proc);
          } else if (procOption === 'kill') {
            const killed = killProcess(selected.pid);
            if (killed) {
              const idx = backgroundProcesses.findIndex(p => p.pid === selected.pid);
              if (idx !== -1) backgroundProcesses.splice(idx, 1);
            }
            needsRefresh = true;
            break;
          } else {
            needsRefresh = true;
            break;
          }
        }
        continue;
      }

      const execOption = await showExecutionOptions(selected);

      if (execOption === 'back') {
        needsRefresh = true;
        continue;
      }

      if (execOption === 'interactive') {
        await runScript(selected, options.directory);
        needsRefresh = true;
      } else if (execOption === 'background') {
        const result = runScriptBackground(selected, options.directory);
        backgroundProcesses.push({ name: selected, pid: result.pid, logs: result.logs });
        needsRefresh = true;
      } else if (execOption === 'copy') {
        const command = getScriptCommand(selected, options.directory);
        try {
          await copyToClipboard(command);
          showSuccess(`Comando copiado: ${command}`);
        } catch {
          showError('Falha ao copiar para clipboard. Comando: ' + command);
        }
        needsRefresh = true;
      }
    }
  } catch (error) {
    showError(error.message);
    process.exit(1);
  }
}

main();
