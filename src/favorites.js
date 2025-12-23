import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'scriptrunner');
const FAVORITES_FILE = join(CONFIG_DIR, 'favorites.json');

async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadFavorites() {
  try {
    await ensureConfigDir();
    if (!existsSync(FAVORITES_FILE)) {
      return [];
    }
    const content = await readFile(FAVORITES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function saveFavorites(favorites) {
  try {
    await ensureConfigDir();
    await writeFile(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
  } catch {
    // Silently fail - favorites is not critical
  }
}

export async function addFavorite(entry) {
  const favorites = await loadFavorites();

  // Check if already exists
  const exists = favorites.some(
    f => f.script === entry.script && f.directory === entry.directory
  );

  if (exists) {
    return false;
  }

  favorites.push({
    script: entry.script,
    directory: entry.directory,
    projectName: entry.projectName,
    addedAt: new Date().toISOString(),
  });

  await saveFavorites(favorites);
  return true;
}

export async function removeFavorite(entry) {
  const favorites = await loadFavorites();

  const index = favorites.findIndex(
    f => f.script === entry.script && f.directory === entry.directory
  );

  if (index === -1) {
    return false;
  }

  favorites.splice(index, 1);
  await saveFavorites(favorites);
  return true;
}

export async function toggleFavorite(entry) {
  const favorites = await loadFavorites();

  const index = favorites.findIndex(
    f => f.script === entry.script && f.directory === entry.directory
  );

  if (index === -1) {
    await addFavorite(entry);
    return true; // Now favorited
  } else {
    await removeFavorite(entry);
    return false; // Now unfavorited
  }
}

export async function isFavorite(script, directory) {
  const favorites = await loadFavorites();
  return favorites.some(f => f.script === script && f.directory === directory);
}

export async function getFavorites(directory) {
  const favorites = await loadFavorites();
  return favorites.filter(f => f.directory === directory);
}

export async function getAllFavorites() {
  return await loadFavorites();
}
