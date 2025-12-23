# ScriptRunner TUI - Proposal

## Overview

TUI interativa para executar scripts do `package.json` de qualquer projeto Node.js. O usuário navega até um diretório e vê todos os scripts disponíveis em uma interface amigável.

## Funcionalidades

### Core Features

1. **Detectar package.json** - Ler o arquivo do diretório atual ou especificado
2. **Listar scripts** - Popular menu com todos os scripts disponíveis
3. **Executar scripts** - Rodar o script selecionado com output em tempo real
4. **Output streaming** - Mostrar stdout/stderr do script enquanto executa
5. **Histórico recente** - Lembrar últimos scripts executados (opcional)

### Menu Principal

```
┌──────────────────────────────────────────────────────────────────────┐
│   ___         _      _   ___                                         │
│  / __| __ _ _(_)_ __| |_| _ \_  _ _ _  _ _  ___ _ _                  │
│  \__ \/ _| '_| | '_ \  _|   / || | ' \| ' \/ -_) '_|                 │
│  |___/\__|_| |_| .__/\__|_|_\\_,_|_||_|_||_\___|_|                   │
│                |_|                                                   │
└──────────────────────────────────────────────────────────────────────┘

  ◉ dev    ◉ build    ◉ test    ◉ lint

─────────────────────────────────────────────────────────────────────────
  ScriptRunner v1.0.0  |  my-project
─────────────────────────────────────────────────────────────────────────

? Select script to run:
❯   dev         → next dev
    build       → next build
    start       → next start
    lint        → eslint .
    test        → vitest
    test:watch  → vitest --watch
    ─────────────
    Exit
```

### Opções de Execução

Após selecionar um script:

```
? How do you want to run "dev"?
❯   Run (interactive)     → Output visível, Ctrl+C para parar
    Run (background)      → Executa em background
    Copy command          → Copia "npm run dev" para clipboard
    Back
```

## Estrutura do Projeto

```
scriptrunner-tui/
├── index.js           # Entry point + CLI args
├── src/
│   ├── ui.js          # Header, spinners, formatação
│   ├── parser.js      # Lê e parseia package.json
│   └── runner.js      # Executa scripts com spawn
├── package.json
├── README.md
└── LICENSE
```

## Stack Técnica

| Dependência | Uso |
|-------------|-----|
| chalk | Cores no terminal |
| @inquirer/prompts | Menus interativos |
| ora | Spinners de loading |
| cli-table3 | Tabelas formatadas |

## Paleta de Cores

```javascript
const COLORS = {
  primary: "#22C55E",    // Verde (sucesso/run)
  secondary: "#3B82F6",  // Azul (info)
  accent: "#F59E0B",     // Amarelo (warning)
  danger: "#EF4444",     // Vermelho (erro/stop)
  muted: "#6B7280"       // Cinza (texto secundário)
};
```

## CLI Arguments

```bash
# Uso básico - executa no diretório atual
scriptrunner

# Especificar diretório
scriptrunner /path/to/project
scriptrunner -d /path/to/project

# Executar script diretamente (sem menu)
scriptrunner dev
scriptrunner -r test

# Listar scripts sem executar
scriptrunner --list
scriptrunner -l

# Ajuda
scriptrunner --help
```

## Fluxo de Execução

```
┌─────────────────┐
│ Inicializar CLI │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Buscar package  │────▶│ Não encontrado?  │──▶ Erro + sugestão
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Extrair scripts │────▶│ Nenhum script?   │──▶ Aviso
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Exibir menu     │◀──────────────────────┐
└────────┬────────┘                       │
         │                                │
         ▼                                │
┌─────────────────┐                       │
│ Script selecion │                       │
└────────┬────────┘                       │
         │                                │
         ▼                                │
┌─────────────────┐                       │
│ Executar script │                       │
└────────┬────────┘                       │
         │                                │
         ▼                                │
┌─────────────────┐                       │
│ Script termina  │───────────────────────┘
└─────────────────┘
```

## Features Avançadas (v2)

- **Watch mode** - Detectar mudanças no package.json e atualizar menu
- **Multi-projeto** - Suporte a monorepos (workspaces)
- **Favoritos** - Marcar scripts usados frequentemente
- **Aliases** - Criar atalhos para scripts longos
- **npm/yarn/pnpm** - Detectar package manager automaticamente
- **Parallel execution** - Rodar múltiplos scripts simultaneamente

## package.json

```json
{
  "name": "scriptrunner-tui",
  "version": "1.0.0",
  "description": "TUI for running package.json scripts interactively",
  "main": "index.js",
  "type": "module",
  "bin": {
    "scriptrunner": "./index.js",
    "sr": "./index.js"
  },
  "files": [
    "index.js",
    "src/**/*"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "start": "node index.js"
  },
  "keywords": [
    "npm",
    "scripts",
    "runner",
    "tui",
    "cli",
    "terminal",
    "package.json"
  ],
  "author": "Mateus Paz <bomberatox@gmail.com>",
  "license": "MIT",
  "dependencies": {
    "@inquirer/prompts": "^7.2.1",
    "chalk": "^5.3.0",
    "ora": "^8.1.0",
    "cli-table3": "^0.6.5"
  }
}
```

## Implementação - Prioridades

### P0 - MVP

1. [x] Setup projeto (package.json, estrutura)
2. [x] Ler package.json do diretório atual
3. [x] Exibir lista de scripts com select
4. [x] Executar script selecionado (spawn com inherit)
5. [x] Header ASCII art
6. [x] Tratamento de erros básico

### P1 - Polish

1. [x] CLI args (--help, -d path, -l)
2. [x] Detectar package manager (npm/yarn/pnpm)
3. [x] Colorir scripts por tipo (dev, test, build)
4. [x] Mostrar descrição dos scripts (se existir)
5. [x] Opções de execução (interactive/background)

### P2 - Nice to Have

1. [ ] Histórico de execução
2. [ ] Suporte a monorepo
3. [ ] Copy to clipboard
4. [ ] Favoritos

## Aprovação

- [ ] Estrutura aprovada
- [ ] Paleta de cores aprovada
- [ ] Funcionalidades MVP definidas
- [ ] Pronto para implementação
