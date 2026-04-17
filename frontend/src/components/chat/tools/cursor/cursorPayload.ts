// Cursor CLI (cursor-agent) speaks the lowercase ACP tool kinds: execute,
// read, search, edit. rawInput is always empty on the initial tool_call event
// (Cursor only populates it for audit trails, not streaming), so renderers key
// off `tool.title` for the header and `tool.result` for the payload.
//
// Output shapes observed live:
//   execute  → { exitCode: number, stdout: string, stderr: string }
//   read     → { content: string }
//   search   → { totalMatches?: number, totalFiles?: number, truncated: boolean }
//   edit     → ACP content blocks [{type:"diff", path, oldText, newText}],
//              surfaced by the backend as { diffs: [...] } on tool.result.

export interface CursorExecuteOutput {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface CursorReadOutput {
  content?: string;
}

export interface CursorSearchOutput {
  totalMatches?: number;
  totalFiles?: number;
  truncated?: boolean;
}

export interface CursorDiffBlock {
  path?: string;
  oldText?: string;
  newText?: string;
}

export interface CursorEditOutput {
  diffs?: CursorDiffBlock[];
}
