import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { glob } from 'node:fs/promises';

export async function detectMonorepo(directory) {
  const packagePath = join(directory, 'package.json');

  if (!existsSync(packagePath)) {
    return null;
  }

  try {
    const content = await readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(content);

    // Check for npm/yarn workspaces
    if (pkg.workspaces) {
      const patterns = Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : pkg.workspaces.packages || [];

      return {
        type: 'workspaces',
        patterns,
        rootDir: directory,
      };
    }

    // Check for pnpm-workspace.yaml
    const pnpmWorkspacePath = join(directory, 'pnpm-workspace.yaml');
    if (existsSync(pnpmWorkspacePath)) {
      const workspaceContent = await readFile(pnpmWorkspacePath, 'utf-8');
      const patterns = parseYamlPackages(workspaceContent);

      return {
        type: 'pnpm',
        patterns,
        rootDir: directory,
      };
    }

    // Check for lerna.json
    const lernaPath = join(directory, 'lerna.json');
    if (existsSync(lernaPath)) {
      const lernaContent = await readFile(lernaPath, 'utf-8');
      const lerna = JSON.parse(lernaContent);

      return {
        type: 'lerna',
        patterns: lerna.packages || ['packages/*'],
        rootDir: directory,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseYamlPackages(content) {
  // Simple YAML parser for packages array
  const lines = content.split('\n');
  const packages = [];
  let inPackages = false;

  for (const line of lines) {
    if (line.trim() === 'packages:') {
      inPackages = true;
      continue;
    }

    if (inPackages) {
      const match = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
      if (match) {
        packages.push(match[1]);
      } else if (line.trim() && !line.startsWith(' ') && !line.startsWith('-')) {
        break;
      }
    }
  }

  return packages.length > 0 ? packages : ['packages/*'];
}

export async function findWorkspaces(monorepoConfig) {
  if (!monorepoConfig) {
    return [];
  }

  const { patterns, rootDir } = monorepoConfig;
  const workspaces = [];

  for (const pattern of patterns) {
    const matches = await expandGlobPattern(pattern, rootDir);

    for (const dir of matches) {
      const packagePath = join(dir, 'package.json');

      if (existsSync(packagePath)) {
        try {
          const content = await readFile(packagePath, 'utf-8');
          const pkg = JSON.parse(content);

          workspaces.push({
            name: pkg.name || basename(dir),
            path: dir,
            relativePath: dir.replace(rootDir + '/', ''),
            scripts: pkg.scripts || {},
            scriptsDescriptions: pkg.scriptsDescriptions || pkg['scripts-info'] || {},
          });
        } catch {
          // Skip invalid packages
        }
      }
    }
  }

  // Sort by name
  workspaces.sort((a, b) => a.name.localeCompare(b.name));

  return workspaces;
}

async function expandGlobPattern(pattern, rootDir) {
  const results = [];

  // Handle simple patterns like "packages/*" or "apps/*"
  if (pattern.endsWith('/*')) {
    const baseDir = join(rootDir, pattern.slice(0, -2));

    if (existsSync(baseDir)) {
      try {
        const entries = await readdir(baseDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            results.push(join(baseDir, entry.name));
          }
        }
      } catch {
        // Skip on error
      }
    }
  }
  // Handle patterns like "packages/**" (recursive)
  else if (pattern.endsWith('/**')) {
    const baseDir = join(rootDir, pattern.slice(0, -3));
    await findPackagesRecursive(baseDir, results, 3);
  }
  // Handle exact paths
  else {
    const exactPath = join(rootDir, pattern);
    if (existsSync(exactPath)) {
      results.push(exactPath);
    }
  }

  return results;
}

async function findPackagesRecursive(dir, results, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth || !existsSync(dir)) {
    return;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const fullPath = join(dir, entry.name);
        const hasPackage = existsSync(join(fullPath, 'package.json'));

        if (hasPackage) {
          results.push(fullPath);
        }

        await findPackagesRecursive(fullPath, results, maxDepth, currentDepth + 1);
      }
    }
  } catch {
    // Skip on error
  }
}

export function isMonorepo(monorepoConfig) {
  return monorepoConfig !== null;
}
