export interface CopilotExecuteInput {
  command?: string;
  commands?: string[];
  description?: string;
  initial_wait?: number;
}

export interface CopilotReadInput {
  path?: string;
  view_range?: [number, number];
  pattern?: string;
}

// Copilot's `edit` rawInput varies by underlying model:
//   - GPT family: a single patch string wrapped by the backend into {raw: "<patch>"}
//   - Claude family (create): {path, file_text}
//   - Claude family (str_replace): {path, old_str, new_str}
// rawOutput is consistent across models: {content, detailedContent}.
// detailedContent is always a unified diff so editing UIs can render one shape.
export interface CopilotEditInput {
  raw?: string;
  path?: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
}

export interface CopilotFetchInput {
  url?: string;
  max_length?: number;
}

export interface CopilotToolOutput {
  content?: string;
  detailedContent?: string;
}
