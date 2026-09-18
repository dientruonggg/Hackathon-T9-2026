import type { Result, IsoTimestamp, MemoryStatus } from "@vlc/contracts";
import type { 
  MemoryMarker, 
  MemorySummary, 
  SaveMarkerInput, 
  SearchMemoryInput, 
  UpdateUnderstandingInput, 
  ForgetMemoryInput, 
  ForgetMemoryOutput, 
  SourcePolicySettings, 
  UpdateSourcePolicyInput 
} from "@vlc/contracts";

export interface StorageAreaLike {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  createId(): string;
}

export interface ExclusiveLock {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export interface MemoryRepository {
  listMarkers(): Promise<Result<MemoryMarker[]>>;
  saveMarker(input: SaveMarkerInput): Promise<Result<MemoryMarker>>;
  searchMemory(input: SearchMemoryInput): Promise<Result<MemorySummary[]>>;
  readMemory(memoryId: string): Promise<Result<MemoryMarker | null>>;
  updateUnderstanding(
    input: UpdateUnderstandingInput,
  ): Promise<Result<MemoryMarker>>;
  forgetMemory(
    input: ForgetMemoryInput,
  ): Promise<Result<ForgetMemoryOutput>>;
  getSourcePolicySettings(): Promise<Result<SourcePolicySettings>>;
  updateSourcePolicy(
    input: UpdateSourcePolicyInput,
  ): Promise<Result<SourcePolicySettings>>;
}
