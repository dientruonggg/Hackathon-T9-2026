import type { AgentToolName, AppErrorCode, GroundingKind } from "@vlc/contracts";

export type SafeAgentEvent =
  | { event: "agent.turn.started"; turnId: string }
  | {
      event: "agent.tool.completed";
      turnId: string;
      step: 1 | 2 | 3;
      toolName: AgentToolName;
      status: "SUCCESS";
    }
  | {
      event: "agent.tool.completed";
      turnId: string;
      step: 1 | 2 | 3;
      toolName: AgentToolName;
      status: "ERROR";
      errorCode: AppErrorCode;
    }
  | {
      event: "agent.turn.completed";
      turnId: string;
      durationMs: number;
      grounding: GroundingKind;
      toolCount: number;
      modelName: string;
    }
  | {
      event: "agent.turn.failed";
      turnId: string;
      durationMs: number;
      errorCode: AppErrorCode;
      retryable: boolean;
    };

export interface AgentObserver {
  emit(event: SafeAgentEvent): void;
}

export class ConsoleJsonAgentObserver implements AgentObserver {
  emit(event: SafeAgentEvent): void {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
}

export class NoopAgentObserver implements AgentObserver {
  emit(_event: SafeAgentEvent): void {
    // No-op
  }
}

export class MemoryAgentObserver implements AgentObserver {
  public readonly events: SafeAgentEvent[] = [];

  emit(event: SafeAgentEvent): void {
    this.events.push(event);
  }

  clear(): void {
    this.events.length = 0;
  }
}
