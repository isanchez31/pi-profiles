import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
type ProfileName = "reviewer" | "planner" | "coder";

interface Profile {
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  tools: string[];
  instructions: string;
}

interface Baseline {
  provider?: string;
  model?: string;
  thinkingLevel: ThinkingLevel;
  tools: string[];
}

// Adjust these three model IDs if you want to use a different model per profile.
const PROFILES: Record<ProfileName, Profile> = {
  reviewer: {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
    thinkingLevel: "medium",
    tools: ["read", "grep", "find", "ls"],
    instructions: `You are in REVIEWER mode. Analyze the project or changes thoroughly, but never modify files or execute commands. Use only the available read-only tools. Report findings ordered by severity, with concrete file and line references when possible. Do not propose implementation steps unless the user asks.`,
  },
  planner: {
    provider: "openai-codex",
    model: "gpt-5.6-sol",
    thinkingLevel: "xhigh",
    tools: ["read", "grep", "find", "ls"],
    instructions: `You are in PLANNER mode. Investigate the codebase thoroughly and produce a precise, actionable implementation plan. Do not modify files or execute commands. Before finalizing, identify affected files, dependencies, risks, edge cases, validation steps, and unanswered questions. Present the plan as numbered steps.`,
  },
  coder: {
    provider: "openai-codex",
    model: "gpt-5.6-terra",
    thinkingLevel: "high",
    tools: ["read", "grep", "find", "ls", "bash", "edit", "write"],
    instructions: `You are in CODER mode. Implement the requested change carefully. Read relevant code before modifying it, keep changes focused, and run the relevant checks or tests when practical. Summarize the changes and validation performed.`,
  },
};

const READ_ONLY_PROFILES = new Set<ProfileName>(["reviewer", "planner"]);
const PROFILE_NAMES = Object.keys(PROFILES) as ProfileName[];

export default function agentProfiles(pi: ExtensionAPI) {
  let activeProfile: ProfileName | undefined;
  let baseline: Baseline | undefined;

  function updateStatus(ctx: ExtensionContext) {
    ctx.ui.setStatus(
      "agent-profile",
      activeProfile ? ctx.ui.theme.fg("accent", `profile:${activeProfile}`) : undefined,
    );
  }

  function captureBaseline(ctx: ExtensionContext) {
    if (baseline) return;
    baseline = {
      provider: ctx.model?.provider,
      model: ctx.model?.id,
      thinkingLevel: pi.getThinkingLevel(),
      tools: pi.getActiveTools(),
    };
    pi.appendEntry("agent-profile-baseline", baseline);
  }

  async function applyProfile(name: ProfileName, ctx: ExtensionContext, persist = true): Promise<boolean> {
    const profile = PROFILES[name];
    const model = ctx.modelRegistry.find(profile.provider, profile.model);

    if (!model) {
      ctx.ui.notify(`Profile \"${name}\": model ${profile.provider}/${profile.model} is unavailable`, "error");
      return false;
    }

    if (!(await pi.setModel(model))) {
      ctx.ui.notify(`Profile \"${name}\": no credentials for ${profile.provider}/${profile.model}`, "error");
      return false;
    }

    captureBaseline(ctx);
    pi.setThinkingLevel(profile.thinkingLevel);

    const knownTools = new Set(pi.getAllTools().map((tool) => tool.name));
    const missingTools = profile.tools.filter((tool) => !knownTools.has(tool));
    pi.setActiveTools(profile.tools.filter((tool) => knownTools.has(tool)));
    if (missingTools.length > 0) {
      ctx.ui.notify(`Profile \"${name}\": unavailable tools: ${missingTools.join(", ")}`, "warning");
    }

    activeProfile = name;
    updateStatus(ctx);
    if (persist) pi.appendEntry("agent-profile-state", { name });
    ctx.ui.notify(`Profile \"${name}\" activated (${profile.model}, thinking:${profile.thinkingLevel})`, "info");
    return true;
  }

  async function deactivateProfiles(ctx: ExtensionContext) {
    if (baseline?.provider && baseline.model) {
      const model = ctx.modelRegistry.find(baseline.provider, baseline.model);
      if (model) await pi.setModel(model);
    }
    if (baseline) {
      pi.setThinkingLevel(baseline.thinkingLevel);
      const knownTools = new Set(pi.getAllTools().map((tool) => tool.name));
      pi.setActiveTools(baseline.tools.filter((tool) => knownTools.has(tool)));
    }
    activeProfile = undefined;
    updateStatus(ctx);
    pi.appendEntry("agent-profile-state", { name: null });
    ctx.ui.notify("Agent profile disabled; previous configuration restored.", "info");
  }

  function registerProfileCommand(name: ProfileName) {
    pi.registerCommand(name, {
      description: `Activate the ${name} profile`,
      handler: async (_args, ctx) => {
        await applyProfile(name, ctx);
      },
    });
  }

  for (const name of PROFILE_NAMES) registerProfileCommand(name);

  pi.registerCommand("profile", {
    description: "Show the active profile, or disable it with /profile off",
    handler: async (args, ctx) => {
      if (args.trim().toLowerCase() === "off") {
        await deactivateProfiles(ctx);
        return;
      }
      if (!activeProfile) {
        ctx.ui.notify("No profile is active. Use /reviewer, /planner, or /coder.", "info");
        return;
      }
      const profile = PROFILES[activeProfile];
      ctx.ui.notify(
        `profile:${activeProfile} | ${profile.provider}/${profile.model} | thinking:${profile.thinkingLevel}`,
        "info",
      );
    },
  });

  // Function keys avoid conflicts with Pi's default Ctrl-based shortcuts.
  pi.registerShortcut("f5", { description: "Disable agent profile", handler: deactivateProfiles });
  pi.registerShortcut("f6", { description: "Activate reviewer profile", handler: (ctx) => applyProfile("reviewer", ctx) });
  pi.registerShortcut("f7", { description: "Activate planner profile", handler: (ctx) => applyProfile("planner", ctx) });
  pi.registerShortcut("f8", { description: "Activate coder profile", handler: (ctx) => applyProfile("coder", ctx) });

  pi.on("before_agent_start", (event) => {
    if (!activeProfile) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${PROFILES[activeProfile].instructions}` };
  });

  // Defense in depth: read-only profiles cannot execute a tool outside their allowlist.
  pi.on("tool_call", (event) => {
    if (!activeProfile || !READ_ONLY_PROFILES.has(activeProfile)) return;
    if (!PROFILES[activeProfile].tools.includes(event.toolName)) {
      return { block: true, reason: `${activeProfile} profile permits read-only tools only`, terminate: true };
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const savedBaseline = entries
      .filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === "agent-profile-baseline")
      .pop() as { data?: Baseline } | undefined;
    baseline = savedBaseline?.data;

    const saved = entries
      .filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === "agent-profile-state")
      .pop() as { data?: { name?: string | null } } | undefined;

    const name = saved?.data?.name;
    if (name && PROFILE_NAMES.includes(name as ProfileName)) {
      await applyProfile(name as ProfileName, ctx, false);
    } else {
      updateStatus(ctx);
    }
  });
}
