import type { Result, SourcePolicySettings, MemorySummary, ForgetMemoryOutput } from "@vlc/contracts";
import type { MemoryRepository } from "@vlc/memory";

export interface PrivacyMemoryState {
  currentDomain: string;
  isCurrentDomainUserBlocked: boolean;
  blockedDomains: string[];
  relatedMemories: MemorySummary[];
}

export interface PrivacyMemoryDependencies {
  memoryRepository: MemoryRepository;
}

function normalizeDomain(domain: string): string {
  let lower = domain.toLowerCase();
  if (lower.startsWith("www.")) {
    lower = lower.substring(4);
  }
  if (lower.endsWith(".")) {
    lower = lower.substring(0, lower.length - 1);
  }
  return lower;
}

export async function loadPrivacyMemoryState(
  input: { currentDomain: string; relatedMemories: MemorySummary[] },
  deps: PrivacyMemoryDependencies,
): Promise<Result<PrivacyMemoryState>> {
  const normDomain = normalizeDomain(input.currentDomain);
  const settingsResult = await deps.memoryRepository.getSourcePolicySettings();

  if (!settingsResult.ok) {
    return settingsResult;
  }

  const blockedDomains = settingsResult.data.blockedDomains || [];
  const isBlocked = blockedDomains.includes(normDomain);

  return {
    ok: true,
    data: {
      currentDomain: normDomain,
      isCurrentDomainUserBlocked: isBlocked,
      blockedDomains,
      relatedMemories: input.relatedMemories.slice(0, 5),
    }
  };
}

export async function blockCurrentDomain(
  input: { domain: string; userConfirmed: true },
  deps: PrivacyMemoryDependencies,
): Promise<Result<SourcePolicySettings>> {
  const normDomain = normalizeDomain(input.domain);
  return deps.memoryRepository.updateSourcePolicy({
    domain: normDomain,
    action: "BLOCK",
    userConfirmed: input.userConfirmed
  });
}

export async function unblockDomain(
  input: { domain: string; userConfirmed: true },
  deps: PrivacyMemoryDependencies,
): Promise<Result<SourcePolicySettings>> {
  const normDomain = normalizeDomain(input.domain);
  return deps.memoryRepository.updateSourcePolicy({
    domain: normDomain,
    action: "RESET",
    userConfirmed: input.userConfirmed
  });
}

export async function forgetConfirmedMarker(
  input: { memoryId: string; userConfirmed: true },
  deps: PrivacyMemoryDependencies,
): Promise<Result<ForgetMemoryOutput>> {
  return deps.memoryRepository.forgetMemory({
    scope: "ONE",
    memoryId: input.memoryId,
    userConfirmed: input.userConfirmed
  });
}
