import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function parsePackageJson(directory) {
  const packagePath = join(directory, 'package.json');

  try {
    const content = await readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(content);

    return {
      scripts: pkg.scripts || {},
      scriptsDescriptions: pkg.scriptsDescriptions || pkg['scripts-info'] || {},
      projectName: pkg.name || 'unknown',
      version: pkg.version || '0.0.0',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`package.json não encontrado em: ${directory}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error('package.json contém JSON inválido');
    }
    throw error;
  }
}
