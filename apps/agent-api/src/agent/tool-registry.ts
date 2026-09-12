import type {
  ViewportContext,
  MemorySummary,
  AgentPermissions,
  AgentToolName,
  PendingUserAction,
  Result,
  SearchWebToolOutput
} from "@vlc/contracts";
import {
  GetViewportContextToolInputSchema,
  SearchMemoryToolInputSchema,
  ReadMemoryToolInputSchema,
  ProposeMarkerToolInputSchema,
  SearchWebToolInputSchema
} from "@vlc/contracts";

export interface TurnToolContext {
  turnId: string;
  context: ViewportContext;
  relatedMemories: MemorySummary[];
  permissions: AgentPermissions;
}

export interface AgentToolDependencies {
  webSearcher?: (query: string) => Promise<Result<SearchWebToolOutput>>;
}

export interface AgentTool {
  name: AgentToolName;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<Result<unknown>>;
}

export function createAgentToolRegistry(
  context: TurnToolContext,
  deps: AgentToolDependencies = {}
): ReadonlyMap<AgentToolName, AgentTool> {
  const tools = new Map<AgentToolName, AgentTool>();

  // 1. get_viewport_context
  tools.set("get_viewport_context", {
    name: "get_viewport_context",
    description: "Lấy toàn bộ thông tin phần nội dung trang web đang nằm trong viewport hiện tại của người học.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    async execute(args: Record<string, unknown>): Promise<Result<unknown>> {
      const parsed = GetViewportContextToolInputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Lỗi đối số cho get_viewport_context: ${parsed.error.message}`,
            retryable: false
          }
        };
      }
      return {
        ok: true,
        data: context.context
      };
    }
  });

  // 2. search_memory
  tools.set("search_memory", {
    name: "search_memory",
    description: "Tìm kiếm dấu mốc trong danh sách các ký ức liên quan được preload sẵn cho section này.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Từ khóa cần tìm trong tiêu đề heading, câu hỏi hoặc ghi chú cũ"
        },
        status: {
          type: "string",
          enum: ["UNDERSTOOD", "NOT_UNDERSTOOD", "REVIEW_LATER"],
          description: "Lọc theo trạng thái hiểu"
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Số lượng kết quả tối đa cần lấy (mặc định 5)"
        }
      },
      required: ["query"],
      additionalProperties: false
    },
    async execute(args: Record<string, unknown>): Promise<Result<unknown>> {
      const parsed = SearchMemoryToolInputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Lỗi đối số cho search_memory: ${parsed.error.message}`,
            retryable: false
          }
        };
      }

      const { query, status, limit = 5 } = parsed.data;
      const lowerQuery = query.toLowerCase().trim();
      const isGeneralQuery =
        !lowerQuery ||
        lowerQuery === "*" ||
        lowerQuery === "all" ||
        /^(đã học|học|học gì|những gì|toàn bộ|tất cả|lịch sử|tổng hợp|ôn tập|summary|overview|what did i learn|history|learned)$/i.test(lowerQuery) ||
        lowerQuery.includes("đã học") ||
        lowerQuery.includes("học gì") ||
        lowerQuery.includes("tôi đã học");

      const filtered = context.relatedMemories.filter((mem) => {
        if (status && mem.status !== status) {
          return false;
        }

        if (isGeneralQuery) {
          return true;
        }

        const matchHeading = mem.anchor.heading.toLowerCase().includes(lowerQuery);
        const matchNote = mem.note?.toLowerCase().includes(lowerQuery) ?? false;
        const matchQuestion = mem.question?.toLowerCase().includes(lowerQuery) ?? false;
        const matchAnswer = mem.answerSummary?.toLowerCase().includes(lowerQuery) ?? false;
        const matchTitle = mem.source.title.toLowerCase().includes(lowerQuery);

        return matchHeading || matchNote || matchQuestion || matchAnswer || matchTitle;
      });

      // Sắp xếp giảm dần theo matchScore
      filtered.sort((a, b) => b.matchScore - a.matchScore);

      return {
        ok: true,
        data: filtered.slice(0, Math.min(limit, 5))
      };
    }
  });

  // 3. read_memory
  tools.set("read_memory", {
    name: "read_memory",
    description: "Đọc chi tiết một dấu mốc đã biết theo memoryId (chỉ trong danh sách preload).",
    parameters: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "ID của memory cần đọc"
        }
      },
      required: ["memoryId"],
      additionalProperties: false
    },
    async execute(args: Record<string, unknown>): Promise<Result<unknown>> {
      const parsed = ReadMemoryToolInputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Lỗi đối số cho read_memory: ${parsed.error.message}`,
            retryable: false
          }
        };
      }

      const found = context.relatedMemories.find((m) => m.id === parsed.data.memoryId);
      if (!found) {
        return {
          ok: false,
          error: {
            code: "MEMORY_NOT_FOUND",
            message: `Ký ức với ID ${parsed.data.memoryId} không tồn tại trong danh sách preload của turn hiện tại`,
            retryable: false
          }
        };
      }

      return {
        ok: true,
        data: found
      };
    }
  });

  // 4. propose_marker
  tools.set("propose_marker", {
    name: "propose_marker",
    description: "Đề xuất lưu dấu mốc trạng thái học tập (Đã hiểu / Chưa hiểu / Xem lại sau). Đây chỉ là ĐỀ XUẤT, người dùng phải bấm nút xác nhận.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["UNDERSTOOD", "NOT_UNDERSTOOD", "REVIEW_LATER"],
          description: "Trạng thái học tập đề xuất"
        },
        note: {
          type: "string",
          maxLength: 500,
          description: "Ghi chú ngắn gọn tóm tắt nội dung cần nhớ hoặc vướng mắc"
        },
        reason: {
          type: "string",
          maxLength: 500,
          description: "Lý do đề xuất trạng thái này"
        }
      },
      required: ["status", "reason"],
      additionalProperties: false
    },
    async execute(args: Record<string, unknown>): Promise<Result<unknown>> {
      const parsed = ProposeMarkerToolInputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Lỗi đối số cho propose_marker: ${parsed.error.message}`,
            retryable: false
          }
        };
      }

      const action: PendingUserAction = {
        id: `proposal-${context.turnId}-${Date.now()}`,
        type: "CONFIRM_MARKER",
        payload: {
          status: parsed.data.status,
          note: parsed.data.note
        },
        confirmationText: `Xác nhận đánh dấu: ${parsed.data.status}${parsed.data.note ? ` - "${parsed.data.note}"` : ""}`
      };

      return {
        ok: true,
        data: action
      };
    }
  });

  // 5. search_web
  tools.set("search_web", {
    name: "search_web",
    description: "Tìm kiếm thông tin bổ sung trên web khi người dùng cho phép.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Câu truy vấn tìm kiếm ngắn gọn"
        }
      },
      required: ["query"],
      additionalProperties: false
    },
    async execute(args: Record<string, unknown>): Promise<Result<unknown>> {
      if (!context.permissions.allowWebSearch) {
        return {
          ok: false,
          error: {
            code: "PERMISSION_DENIED",
            message: "Quyền tìm kiếm web đang bị tắt bởi người học trong lượt này",
            retryable: false
          }
        };
      }

      const parsed = SearchWebToolInputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Lỗi đối số cho search_web: ${parsed.error.message}`,
            retryable: false
          }
        };
      }

      if (deps.webSearcher) {
        return deps.webSearcher(parsed.data.query);
      }

      const emptyOutput: SearchWebToolOutput = {
        results: []
      };
      return {
        ok: true,
        data: emptyOutput
      };
    }
  });

  return tools;
}
