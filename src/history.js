import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'scriptrunner');
const HISTORY_FILE = join(CONFIG_DIR, 'history.json');
const MAX_HISTORY_ENTRIES = 20;

async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadHistory() {
  try {
    await ensureConfigDir();
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }
    const content = await readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function saveHistory(history) {
  try {
    await ensureConfigDir();
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch {
    // Silently fail - history is not critical
  }
}

export async function addToHistory(entry) {
  const history = await loadHistory();

  // Remove duplicate if exists
  const existingIndex = history.findIndex(
    h => h.script === entry.script && h.directory === entry.directory
  );
  if (existingIndex !== -1) {
    history.splice(existingIndex, 1);
  }

  // Add to beginning
  history.unshift({
    script: entry.script,
    directory: entry.directory,
    projectName: entry.projectName,
    timestamp: new Date().toISOString(),
  });

  // Trim to max size
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.length = MAX_HISTORY_ENTRIES;
  }

  await saveHistory(history);
}

export async function getRecentScripts(directory, limit = 5) {
  const history = await loadHistory();

  return history
    .filter(h => h.directory === directory)
    .slice(0, limit);
}

export async function getGlobalRecentScripts(limit = 10) {
  const history = await loadHistory();
  return history.slice(0, limit);
}

export async function clearHistory() {
  await saveHistory([]);
}
