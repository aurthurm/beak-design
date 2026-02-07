/**
 * CLI Agent Adapter
 * Executes CLI tools (codex, geminicli, claudecode) as subprocesses.
 * Codex uses protocol mode (stdin JSON); other tools use --prompt.
 */

import { BaseAgentAdapter } from './index'
import type { AgentConfig, ChatRequest, ChatDelta } from './index'

function isCodexCommand(command: string): boolean {
  const base = command.split(/[/\\]/).pop()?.toLowerCase() ?? ''
  return base === 'codex' || (base.endsWith('.cmd') && base.includes('codex'))
}

export class CLIAgentAdapter extends BaseAgentAdapter {
  name = 'CLI Tool'
  config: AgentConfig

  constructor(config: AgentConfig) {
    super()
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window !== 'undefined') {
      return false // CLI tools only work server-side
    }

    if (!this.config.command) {
      return false
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // Check if command exists
      await execAsync(`which ${this.config.command}`, { timeout: 1000 })
      return true
    } catch {
      return false
    }
  }

  supportsTools(): boolean {
    // CLI tools may support tools, but we'll need to check per tool
    // For now, assume limited support
    return false
  }

  async getAvailableModels(): Promise<string[]> {
    // CLI tools typically don't expose model lists
    return []
  }

  /**
   * Codex protocol mode: spawn `codex proto`, send JSON submission on stdin,
   * read JSON-line events from stdout (SessionConfigured, StreamingResponse, FinalResponse).
   */
  private async *streamCodexProtocol(
    command: string,
    prompt: string
  ): AsyncIterable<ChatDelta> {
    const { spawn } = await import('child_process')
    const readline = await import('readline')

    const args = this.config.args || []
    const hasProto = args.some((a) => a === 'proto' || a === 'p')
    const protoArgs = hasProto ? args : ['proto', ...args]

    const proc = spawn(command, protoArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stderr = ''
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    const submission = {
      id: `beak-${Date.now()}`,
      type: 'text',
      content: prompt,
    }
    proc.stdin.write(JSON.stringify(submission) + '\n')
    proc.stdin.end()

    const rl = readline.createInterface({
      input: proc.stdout,
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event = JSON.parse(trimmed)
        const msg = event?.msg
        if (!msg) continue
        const type = msg.type
        const content =
          msg.content ?? msg.data?.content ?? msg.text ?? msg.data?.text
        if (
          (type === 'StreamingResponse' || type === 'FinalResponse') &&
          typeof content === 'string'
        ) {
          yield this.createTextDelta(content)
        }
        if (type === 'Error' && (msg.error ?? msg.data?.error)) {
          yield this.createError(
            String(msg.error ?? msg.data?.error ?? 'Codex reported an error')
          )
          break
        }
      } catch {
        // ignore non-JSON or malformed lines
      }
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      proc.on('close', resolve)
    })
    if (exitCode !== 0 && exitCode !== null) {
      const hint = stderr.trim()
        ? ` — ${stderr.trim().replace(/\n/g, ' ').slice(0, 200)}`
        : ''
      yield this.createError(
        `Codex exited with code ${exitCode}${hint}`.trim()
      )
    }
    yield this.createDone()
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatDelta> {
    if (typeof window !== 'undefined') {
      yield this.createError('CLI adapter should be used server-side only')
      return
    }

    if (!this.config.command) {
      yield this.createError('CLI command not configured')
      return
    }

    const command = this.config.command
    const prompt = request.messages[request.messages.length - 1]?.content || ''

    // Codex uses protocol mode (stdin JSON) instead of --prompt
    if (isCodexCommand(command)) {
      yield* this.streamCodexProtocol(command, prompt)
      return
    }

    try {
      const { spawn } = await import('child_process')
      const args = this.config.args || []

      const cmdArgs = [...args, '--prompt', prompt]

      // Spawn process
      const proc = spawn(command, cmdArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      // Collect stdout
      proc.stdout.on('data', (data) => {
        stdout += data.toString()
        // Try to stream if CLI supports it
        // For now, collect all output
      })

      // Collect stderr
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      // Wait for process to complete
      await new Promise<void>((resolve, reject) => {
        proc.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            const stderrHint = stderr.trim()
              ? ` — ${stderr.trim().replace(/\n/g, ' ').slice(0, 200)}`
              : ''
            reject(new Error(`Process exited with code ${code}${stderrHint}`))
          }
        })
        proc.on('error', reject)
      })

      // Parse output (CLI tools may return JSON or plain text)
      try {
        const output = JSON.parse(stdout)
        if (output.text) {
          // Stream text response
          for (const char of output.text) {
            yield this.createTextDelta(char)
          }
        } else if (output.response) {
          for (const char of output.response) {
            yield this.createTextDelta(char)
          }
        } else {
          // Plain text output
          for (const char of stdout) {
            yield this.createTextDelta(char)
          }
        }
      } catch {
        // Not JSON, treat as plain text
        for (const char of stdout) {
          yield this.createTextDelta(char)
        }
      }

      if (stderr) {
        console.warn('[CLI Adapter] stderr:', stderr)
      }

      yield this.createDone()
    } catch (error) {
      yield this.createError(
        `CLI execution error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
