/**
 * MessagesApiDispatchAdapter — DispatchPort implementation using the Anthropic Messages API.
 *
 * Supports two dispatch modes:
 * - Single-turn ('messages-api'): for agents that only need text analysis.
 * - Tool-use loop ('messages-api-tools'): for agents that need Read, Write, Edit, etc.
 *
 * Structured output uses the SDK's output_config.format (JSON schema) when available,
 * falling back to parseVerdict() on raw text.
 */

import Anthropic from '@anthropic-ai/sdk';
import { executeTool } from './tools.js';
import { parseVerdict } from './dispatch.js';
import type {
  AgentDefinition,
  DispatchMode,
  DispatchOptions,
  DispatchPort,
  DispatchResult,
  ModelTier,
  Verdict,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default model IDs per tier. */
const DEFAULT_MODEL_IDS: Record<ModelTier, string> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
};

/** Tools that indicate an agent needs the tool-use loop. */
const TOOL_USE_INDICATORS = new Set(['Edit', 'Write', 'Bash']);

/** Maximum iterations for the tool-use loop to prevent runaway agents. */
const MAX_TOOL_USE_ITERATIONS = 25;

/** JSON schema for the Verdict type, used for structured output. */
const VERDICT_SCHEMA = {
  type: 'object' as const,
  properties: {
    verdict: {
      type: 'string' as const,
      enum: ['pass', 'fail', 'conditional_pass', 'inconclusive'],
    },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
    findings: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          severity: {
            type: 'string' as const,
            enum: ['critical', 'high', 'medium', 'low', 'info'],
          },
          description: { type: 'string' as const },
          location: { type: 'string' as const },
          recommendation: { type: 'string' as const },
        },
        required: ['severity', 'description', 'location', 'recommendation'],
      },
    },
  },
  required: ['verdict', 'confidence', 'findings'],
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface MessagesAdapterConfig {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Override model IDs per tier. */
  modelIds?: Partial<Record<ModelTier, string>>;
  /** Project root directory for tool execution (defaults to cwd). */
  projectRoot?: string;
}

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

/**
 * Build Anthropic tool definitions for the agent's declared tools.
 * Only includes tools that we have executors for.
 */
function buildToolSchemas(toolNames: string[]): Anthropic.Tool[] {
  const allTools: Record<string, Anthropic.Tool> = {
    Read: {
      name: 'Read',
      description: 'Read a file from the filesystem. Returns file contents with line numbers.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          offset: { type: 'number', description: 'Line offset to start from (0-based)' },
          limit: { type: 'number', description: 'Maximum number of lines to read' },
        },
        required: ['file_path'],
      },
    },
    Write: {
      name: 'Write',
      description: 'Write content to a file, creating parent directories as needed.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['file_path', 'content'],
      },
    },
    Edit: {
      name: 'Edit',
      description: 'Replace a unique substring in a file. The old_string must appear exactly once.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          old_string: { type: 'string', description: 'Exact text to find (must be unique)' },
          new_string: { type: 'string', description: 'Replacement text' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
    Grep: {
      name: 'Grep',
      description: 'Search file contents by regex pattern. Returns matching lines with paths and line numbers.',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory or file to search in' },
          glob: { type: 'string', description: 'Glob filter for filenames (e.g. *.ts)' },
        },
        required: ['pattern'],
      },
    },
    Glob: {
      name: 'Glob',
      description: 'Find files matching a glob pattern.',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.ts)' },
          path: { type: 'string', description: 'Base directory to search from' },
        },
        required: ['pattern'],
      },
    },
    Bash: {
      name: 'Bash',
      description: 'Execute a bash command. Sensitive env vars are stripped. Timeout defaults to 30s.',
      input_schema: {
        type: 'object' as const,
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['command'],
      },
    },
  };

  return toolNames.filter((name) => name in allTools).map((name) => allTools[name]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for an agent based on its identity and persona.
 */
function buildSystemPrompt(agent: AgentDefinition): string {
  return [
    `You are ${agent.displayName} (${agent.alias}).`,
    `Role: ${agent.role}`,
    '',
    agent.persona,
    '',
    'Respond with a JSON object matching the Verdict schema:',
    '{ "verdict": "pass"|"fail"|"conditional_pass"|"inconclusive", "confidence": 0-1, "findings": [{ "severity": "critical"|"high"|"medium"|"low"|"info", "description": "...", "location": "...", "recommendation": "..." }] }',
    '',
    'Respond ONLY with the JSON object. No markdown fences, no explanation outside the JSON.',
  ].join('\n');
}

/**
 * Extract all text from a Message response's content blocks.
 */
function extractText(content: Anthropic.ContentBlock[]): string {
  const textParts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text);
    }
  }
  return textParts.join('\n');
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class MessagesApiDispatchAdapter implements DispatchPort {
  private readonly client: Anthropic;
  private readonly modelIds: Record<ModelTier, string>;
  private readonly projectRoot: string;

  get mode(): DispatchMode {
    return 'messages-api';
  }

  constructor(config?: MessagesAdapterConfig) {
    const apiKey = config?.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'MessagesApiDispatchAdapter requires an API key. ' +
        'Pass one in config or set ANTHROPIC_API_KEY.',
      );
    }
    this.client = new Anthropic({ apiKey });
    this.modelIds = { ...DEFAULT_MODEL_IDS, ...config?.modelIds };
    this.projectRoot = config?.projectRoot ?? process.cwd();
  }

  async dispatch(
    agents: AgentDefinition[],
    prompt: string,
    options?: DispatchOptions,
  ): Promise<DispatchResult[]> {
    return Promise.all(
      agents.map((agent) => this.dispatchSingle(agent, prompt, options)),
    );
  }

  // -----------------------------------------------------------------------
  // Private — dispatch routing
  // -----------------------------------------------------------------------

  private async dispatchSingle(
    agent: AgentDefinition,
    prompt: string,
    options?: DispatchOptions,
  ): Promise<DispatchResult> {
    const needsTools = agent.tools.some((t) => TOOL_USE_INDICATORS.has(t));
    const start = Date.now();
    const maxTokens = options?.maxTokens ?? (needsTools ? 8192 : 4096);
    const model = this.modelIds[agent.model];

    try {
      if (needsTools) {
        return await this.dispatchWithTools(agent, prompt, model, maxTokens, start);
      }
      return await this.dispatchSingleTurn(agent, prompt, model, maxTokens, start);
    } catch (err: unknown) {
      return {
        agent: agent.alias,
        verdict: null,
        status: 'failed',
        durationMs: Date.now() - start,
        tokensIn: 0,
        tokensOut: 0,
        error: err instanceof Error ? err.message : String(err),
        dispatch_mode: needsTools ? 'messages-api-tools' : 'messages-api',
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private — single-turn dispatch (no tools)
  // -----------------------------------------------------------------------

  private async dispatchSingleTurn(
    agent: AgentDefinition,
    prompt: string,
    model: string,
    maxTokens: number,
    start: number,
  ): Promise<DispatchResult> {
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: buildSystemPrompt(agent),
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: VERDICT_SCHEMA,
        },
      },
    });

    const text = extractText(response.content);
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;

    let verdict: Verdict | null = null;
    try {
      verdict = parseVerdict(text);
    } catch {
      // Structured output should have produced valid JSON, but if parsing
      // fails we report it in the error field rather than throwing.
      return {
        agent: agent.alias,
        verdict: null,
        status: 'failed',
        durationMs: Date.now() - start,
        tokensIn,
        tokensOut,
        error: `Failed to parse verdict from agent response: ${text.slice(0, 200)}`,
        dispatch_mode: 'messages-api',
      };
    }

    return {
      agent: agent.alias,
      verdict,
      status: 'completed',
      durationMs: Date.now() - start,
      tokensIn,
      tokensOut,
      dispatch_mode: 'messages-api',
    };
  }

  // -----------------------------------------------------------------------
  // Private — tool-use dispatch (multi-turn loop)
  // -----------------------------------------------------------------------

  private async dispatchWithTools(
    agent: AgentDefinition,
    prompt: string,
    model: string,
    maxTokens: number,
    start: number,
  ): Promise<DispatchResult> {
    const tools = buildToolSchemas(agent.tools);
    const systemPrompt = buildSystemPrompt(agent);

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt },
    ];

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let iterations = 0;

    // Tool-use loop: keep going while the model requests tool calls.
    while (iterations < MAX_TOOL_USE_ITERATIONS) {
      iterations++;

      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools,
      });

      totalTokensIn += response.usage.input_tokens;
      totalTokensOut += response.usage.output_tokens;

      // If no tool use, the model is done.
      if (response.stop_reason !== 'tool_use') {
        const finalText = extractText(response.content);
        return this.buildToolUseResult(agent, finalText, totalTokensIn, totalTokensOut, start);
      }

      // Execute each tool_use block and collect results.
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          this.projectRoot,
        );
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.isError
            ? `Error: ${result.error ?? 'Unknown error'}`
            : result.output,
          is_error: result.isError,
        });
      }

      // Append the assistant's response and the tool results to the conversation.
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    // Exhausted iteration limit — try to extract a verdict from whatever we have.
    return {
      agent: agent.alias,
      verdict: null,
      status: 'failed',
      durationMs: Date.now() - start,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      error: `Tool-use loop exceeded ${MAX_TOOL_USE_ITERATIONS} iterations without completing`,
      dispatch_mode: 'messages-api-tools',
    };
  }

  /**
   * After the tool-use loop completes, extract a verdict from the final response text.
   * If the final text is not a valid verdict, make one more call asking the model
   * to format its findings as a Verdict JSON.
   */
  private async buildToolUseResult(
    agent: AgentDefinition,
    finalText: string,
    tokensIn: number,
    tokensOut: number,
    start: number,
  ): Promise<DispatchResult> {
    // First, try to parse a verdict directly from the final text.
    try {
      const verdict = parseVerdict(finalText);
      return {
        agent: agent.alias,
        verdict,
        status: 'completed',
        durationMs: Date.now() - start,
        tokensIn,
        tokensOut,
        dispatch_mode: 'messages-api-tools',
      };
    } catch {
      // Final text wasn't a valid verdict — ask the model to format it.
    }

    // Follow-up call to extract a structured verdict from the agent's work.
    try {
      const followUp = await this.client.messages.create({
        model: this.modelIds[agent.model],
        max_tokens: 2048,
        system: buildSystemPrompt(agent),
        messages: [
          {
            role: 'user',
            content: [
              `Based on your analysis below, produce a Verdict JSON object.\n\n`,
              `--- Analysis ---\n${finalText}\n--- End Analysis ---\n\n`,
              `Respond ONLY with the JSON object matching the Verdict schema.`,
            ].join(''),
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: VERDICT_SCHEMA,
          },
        },
      });

      tokensIn += followUp.usage.input_tokens;
      tokensOut += followUp.usage.output_tokens;

      const verdictText = extractText(followUp.content);
      const verdict = parseVerdict(verdictText);

      return {
        agent: agent.alias,
        verdict,
        status: 'completed',
        durationMs: Date.now() - start,
        tokensIn,
        tokensOut,
        dispatch_mode: 'messages-api-tools',
      };
    } catch (err: unknown) {
      return {
        agent: agent.alias,
        verdict: null,
        status: 'failed',
        durationMs: Date.now() - start,
        tokensIn,
        tokensOut,
        error: `Failed to extract verdict after tool-use: ${err instanceof Error ? err.message : String(err)}`,
        dispatch_mode: 'messages-api-tools',
      };
    }
  }
}
