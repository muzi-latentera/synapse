import { lazy } from 'react';
import type { ToolComponent } from '@/types/ui.types';
type ToolModuleLoader = () => Promise<{ default: ToolComponent }>;

const toLazy = (loader: ToolModuleLoader): ToolComponent =>
  lazy(loader) as unknown as ToolComponent;

const codexShellLoader: ToolModuleLoader = () =>
  import('./codex/ShellTool').then((m) => ({ default: m.ShellTool }));

const toolLoaders: Record<string, ToolModuleLoader> = {
  // Claude Code tools
  Agent: () => import('./claude/AgentTool').then((m) => ({ default: m.AgentTool })),
  WebSearch: () => import('./claude/WebSearch').then((m) => ({ default: m.WebSearch })),
  TodoWrite: () => import('./claude/TodoWrite').then((m) => ({ default: m.TodoWrite })),
  Write: () => import('./claude/FileOperationTool').then((m) => ({ default: m.WriteTool })),
  Read: () => import('./claude/FileOperationTool').then((m) => ({ default: m.ReadTool })),
  Edit: () => import('./claude/FileOperationTool').then((m) => ({ default: m.EditTool })),
  Bash: () => import('./claude/BashTool').then((m) => ({ default: m.BashTool })),
  Glob: () => import('./claude/GlobTool').then((m) => ({ default: m.GlobTool })),
  Grep: () => import('./claude/GrepTool').then((m) => ({ default: m.GrepTool })),
  NotebookEdit: () =>
    import('./claude/NotebookEditTool').then((m) => ({ default: m.NotebookEditTool })),
  WebFetch: () => import('./claude/WebFetchTool').then((m) => ({ default: m.WebFetchTool })),
  LSP: () => import('./claude/LSPTool').then((m) => ({ default: m.LSPTool })),
  AgentOutput: () =>
    import('./claude/AgentOutputTool').then((m) => ({ default: m.AgentOutputTool })),
  BashOutput: () => import('./claude/AgentOutputTool').then((m) => ({ default: m.BashOutputTool })),
  KillShell: () => import('./claude/KillShellTool').then((m) => ({ default: m.KillShellTool })),
  EnterPlanMode: () =>
    import('./claude/PlanModeTool').then((m) => ({ default: m.EnterPlanModeTool })),
  ExitPlanMode: () =>
    import('./claude/PlanModeTool').then((m) => ({ default: m.ExitPlanModeTool })),

  // Codex tools (lowercase kind values from ACP)
  execute: codexShellLoader,
  search: () => import('./codex/FetchTool').then((m) => ({ default: m.FetchTool })),
  read: codexShellLoader,
  edit: () => import('./codex/EditTool').then((m) => ({ default: m.EditTool })),
  fetch: () => import('./codex/FetchTool').then((m) => ({ default: m.FetchTool })),
  delete: () => import('./codex/FileActionTool').then((m) => ({ default: m.DeleteTool })),
  move: () => import('./codex/FileActionTool').then((m) => ({ default: m.MoveTool })),
};

const mcpLoader: ToolModuleLoader = () =>
  import('./claude/MCPTool').then((m) => ({ default: m.MCPTool }));
const webSearchLoader: ToolModuleLoader = () =>
  import('./claude/WebSearch').then((m) => ({ default: m.WebSearch }));

const lazyToolComponents = new Map<string, ToolComponent>();

const getOrCreateLazy = (key: string, loader: ToolModuleLoader) => {
  const existing = lazyToolComponents.get(key);
  if (existing) return existing;
  const component = toLazy(loader);
  lazyToolComponents.set(key, component);
  return component;
};

export const getToolComponent = (toolName: string): ToolComponent => {
  if (toolLoaders[toolName]) {
    return getOrCreateLazy(toolName, toolLoaders[toolName]);
  }

  if (
    toolName.startsWith('mcp__web-search-prime__') ||
    toolName.startsWith('mcp__web_search_prime__')
  ) {
    return getOrCreateLazy(toolName, webSearchLoader);
  }

  return getOrCreateLazy(toolName, mcpLoader);
};
