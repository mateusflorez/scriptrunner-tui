#!/usr/bin/env node

import { parsePackageJson } from './src/parser.js';
import { showHeader, showScriptMenu, showScriptMenuWithHistory, showExecutionOptions, showBackgroundProcessOptions, showWorkspaceMenu, showMonorepoHeader, showError, showSuccess, showInfo, showLogs, clearScreen } from './src/ui.js';
import { runScript, runScriptBackground, getScriptCommand, copyToClipboard, killProcess, isProcessRunning } from './src/runner.js';
import { addToHistory, getRecentScripts } from './src/history.js';
import { detectMonorepo, findWorkspaces, isMonorepo } from './src/monorepo.js';
import { toggleFavorite, isFavorite, getFavorites, getAllFavorites } from './src/favorites.js';

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
    const rootPkg = await parsePackageJson(options.directory);
    const monorepoConfig = await detectMonorepo(options.directory);
    const hasMonorepo = isMonorepo(monorepoConfig);

    // Handle list option (non-interactive)
    if (options.list) {
      showHeader(rootPkg.projectName);
      console.log('\nScripts disponíveis:\n');
      for (const [name, command] of Object.entries(rootPkg.scripts)) {
        const desc = rootPkg.scriptsDescriptions[name];
        const descText = desc ? `  # ${desc}` : '';
        console.log(`  ${name} → ${command}${descText}`);
      }
      process.exit(0);
    }

    // Handle direct script execution
    if (options.scriptName) {
      if (!rootPkg.scripts[options.scriptName]) {
        showError(`Script "${options.scriptName}" não encontrado`);
        process.exit(1);
      }
      await addToHistory({ script: options.scriptName, directory: options.directory, projectName: rootPkg.projectName });
      await runScript(options.scriptName, options.directory);
      process.exit(0);
    }

    // Interactive mode
    if (hasMonorepo) {
      await runMonorepoMode(rootPkg, monorepoConfig, options.directory);
    } else {
      await runSingleProjectMode(rootPkg, options.directory);
    }
  } catch (error) {
    showError(error.message);
    process.exit(1);
  }
}

// Helper to handle background process management
async function handleBackgroundProcess(proc, headerFn) {
  while (true) {
    clearScreen();
    headerFn();

    const procOption = await showBackgroundProcessOptions(proc);

    if (procOption === 'logs') {
      clearScreen();
      headerFn();
      await showLogs(proc);
    } else if (procOption === 'kill') {
      const killed = killProcess(proc.pid);
      if (killed) {
        const idx = backgroundProcesses.findIndex(p => p.pid === proc.pid);
        if (idx !== -1) backgroundProcesses.splice(idx, 1);
      }
      return true; // needs refresh
    } else {
      return true; // back - needs refresh
    }
  }
}

// Helper to handle script execution
async function handleScriptExecution(scriptName, directory, projectName, workspaceName = null) {
  const isScriptFavorite = await isFavorite(scriptName, directory);
  const execOption = await showExecutionOptions(scriptName, isScriptFavorite);

  if (execOption === 'back') {
    return 'back';
  }

  if (execOption === 'favorite') {
    const nowFavorite = await toggleFavorite({ script: scriptName, directory, projectName });
    if (nowFavorite) {
      showSuccess(`"${scriptName}" adicionado aos favoritos`);
    } else {
      showInfo(`"${scriptName}" removido dos favoritos`);
    }
  } else if (execOption === 'interactive') {
    await addToHistory({ script: scriptName, directory, projectName });
    await runScript(scriptName, directory);
  } else if (execOption === 'background') {
    await addToHistory({ script: scriptName, directory, projectName });
    const result = runScriptBackground(scriptName, directory);
    backgroundProcesses.push({ name: scriptName, pid: result.pid, logs: result.logs, workspace: workspaceName });
  } else if (execOption === 'copy') {
    const command = getScriptCommand(scriptName, directory);
    try {
      await copyToClipboard(command);
      showSuccess(`Comando copiado: ${command}`);
    } catch {
      showError('Falha ao copiar para clipboard. Comando: ' + command);
    }
  }

  return 'refresh';
}

// Filter dead processes
function cleanupProcesses() {
  const activeProcesses = backgroundProcesses.filter(p => isProcessRunning(p.pid));
  backgroundProcesses.length = 0;
  backgroundProcesses.push(...activeProcesses);
}

// Single project mode (no monorepo)
async function runSingleProjectMode(rootPkg, directory) {
  const { scripts, scriptsDescriptions, projectName } = rootPkg;

  if (Object.keys(scripts).length === 0) {
    showError('Nenhum script encontrado no package.json');
    process.exit(1);
  }

  showHeader(projectName);
  let needsRefresh = false;

  while (true) {
    cleanupProcesses();

    if (needsRefresh) {
      clearScreen();
      showHeader(projectName);
      needsRefresh = false;
    }

    const recentScripts = await getRecentScripts(directory, 3);
    const favorites = await getFavorites(directory);

    const selected = await showScriptMenuWithHistory(scripts, scriptsDescriptions, backgroundProcesses, recentScripts, favorites, false);

    if (selected === 'exit') {
      if (backgroundProcesses.length > 0) {
        showInfo(`${backgroundProcesses.length} processo(s) em background continuarão rodando.`);
      }
      showSuccess('Até mais!');
      break;
    }

    if (typeof selected === 'object' && selected.type === 'background') {
      const proc = backgroundProcesses.find(p => p.pid === selected.pid);
      if (proc) {
        await handleBackgroundProcess(proc, () => showHeader(projectName));
      }
      needsRefresh = true;
      continue;
    }

    await handleScriptExecution(selected, directory, projectName);
    needsRefresh = true;
  }
}

// Monorepo mode with workspace navigation
async function runMonorepoMode(rootPkg, monorepoConfig, rootDirectory) {
  const workspaces = await findWorkspaces(monorepoConfig);

  if (workspaces.length === 0) {
    // Fallback to single project mode if no workspaces found
    await runSingleProjectMode(rootPkg, rootDirectory);
    return;
  }

  // Outer loop: workspace selection
  workspaceLoop: while (true) {
    cleanupProcesses();
    clearScreen();
    showHeader(rootPkg.projectName);

    // Filter favorites to only show those from this monorepo (root or workspaces)
    const allFavorites = await getAllFavorites();
    const monorepoFavorites = allFavorites.filter(fav =>
      fav.directory === rootDirectory || fav.directory.startsWith(rootDirectory + '/')
    );

    const selectedWorkspace = await showWorkspaceMenu(workspaces, rootPkg.projectName, backgroundProcesses, monorepoFavorites);

    if (selectedWorkspace === 'exit') {
      if (backgroundProcesses.length > 0) {
        showInfo(`${backgroundProcesses.length} processo(s) em background continuarão rodando.`);
      }
      showSuccess('Até mais!');
      break;
    }

    // Handle background process from workspace menu
    if (typeof selectedWorkspace === 'object' && selectedWorkspace.type === 'background') {
      const proc = backgroundProcesses.find(p => p.pid === selectedWorkspace.pid);
      if (proc) {
        await handleBackgroundProcess(proc, () => showHeader(rootPkg.projectName));
      }
      continue;
    }

    // Handle favorite from workspace menu (direct execution)
    if (typeof selectedWorkspace === 'object' && selectedWorkspace.type === 'favorite') {
      const fav = selectedWorkspace;
      const result = await handleScriptExecution(fav.script, fav.directory, fav.projectName, fav.projectName);
      if (result === 'back') continue;
      continue;
    }

    // Set current workspace
    let currentDirectory = rootDirectory;
    let currentProject = rootPkg;
    let workspaceName = null;

    if (selectedWorkspace !== 'root') {
      currentDirectory = selectedWorkspace.path;
      currentProject = {
        scripts: selectedWorkspace.scripts,
        scriptsDescriptions: selectedWorkspace.scriptsDescriptions,
        projectName: selectedWorkspace.name,
      };
      workspaceName = selectedWorkspace.name;
    }

    const { scripts, scriptsDescriptions, projectName } = currentProject;

    if (Object.keys(scripts).length === 0) {
      showError('Nenhum script encontrado neste workspace');
      continue;
    }

    // Inner loop: script selection
    let needsRefresh = true;

    while (true) {
      cleanupProcesses();

      if (needsRefresh) {
        clearScreen();
        if (workspaceName) {
          showMonorepoHeader(rootPkg.projectName, workspaceName);
        } else {
          showHeader(projectName);
        }
        needsRefresh = false;
      }

      const recentScripts = await getRecentScripts(currentDirectory, 3);
      const favorites = await getFavorites(currentDirectory);

      const selected = await showScriptMenuWithHistory(scripts, scriptsDescriptions, backgroundProcesses, recentScripts, favorites, true);

      if (selected === 'exit') {
        if (backgroundProcesses.length > 0) {
          showInfo(`${backgroundProcesses.length} processo(s) em background continuarão rodando.`);
        }
        showSuccess('Até mais!');
        break workspaceLoop;
      }

      if (selected === 'back_to_workspaces') {
        break; // Back to outer loop
      }

      if (typeof selected === 'object' && selected.type === 'background') {
        const proc = backgroundProcesses.find(p => p.pid === selected.pid);
        if (proc) {
          const headerFn = workspaceName
            ? () => showMonorepoHeader(rootPkg.projectName, workspaceName)
            : () => showHeader(projectName);
          await handleBackgroundProcess(proc, headerFn);
        }
        needsRefresh = true;
        continue;
      }

      await handleScriptExecution(selected, currentDirectory, projectName, workspaceName);
      needsRefresh = true;
    }
  }
}

main();
