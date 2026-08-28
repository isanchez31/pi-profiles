import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Type } from "typebox";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
type BuiltInProfileName = "reviewer" | "planner" | "coder";
type ProfileName = BuiltInProfileName | string;

interface Profile {
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  tools: string[];
  instructions: string;
}

interface ProfileOverrides {
  profiles?: Record<string, Partial<Profile>>;
  shortcuts?: Record<string, string>;
}

interface Baseline {
  provider?: string;
  model?: string;
  thinkingLevel: ThinkingLevel;
  tools: string[];
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-profiles.json");
const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const DEFAULT_PROFILES: Record<BuiltInProfileName, Profile> = {
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
const BUILT_IN_PROFILE_NAMES = Object.keys(DEFAULT_PROFILES) as BuiltInProfileName[];
const DEFAULT_SHORTCUTS: Record<string, string> = {
  off: "f5",
  reviewer: "f6",
  planner: "f7",
  coder: "f8",
};

function isThinkingLevel(value: string): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel);
}

function parseModelRef(modelRef: string): { provider: string; model: string } | undefined {
  const slashIndex = modelRef.indexOf("/");
  if (slashIndex <= 0 || slashIndex === modelRef.length - 1) return undefined;
  return { provider: modelRef.slice(0, slashIndex), model: modelRef.slice(slashIndex + 1) };
}

function loadOverrides(): ProfileOverrides {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as ProfileOverrides;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: ProfileOverrides) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(overrides, null, 2)}\n`);
}

function mergeProfiles(overrides: ProfileOverrides): Record<string, Profile> {
  const profiles: Record<string, Profile> = { ...DEFAULT_PROFILES };
  for (const [name, override] of Object.entries(overrides.profiles ?? {})) {
    const base = profiles[name] ?? DEFAULT_PROFILES.coder;
    profiles[name] = { ...base, ...override };
  }
  return profiles;
}

function mergeShortcuts(overrides: ProfileOverrides): Record<string, string> {
  return { ...DEFAULT_SHORTCUTS, ...(overrides.shortcuts ?? {}) };
}

function formatShortcuts(shortcuts: Record<string, string>): string {
  return Object.entries(shortcuts)
    .map(([name, shortcut]) => `${name}: ${shortcut}`)
    .join("\n");
}

export default function agentProfiles(pi: ExtensionAPI) {
  let activeProfile: ProfileName | undefined;
  let baseline: Baseline | undefined;
  let overrides = loadOverrides();
  let profiles = mergeProfiles(overrides);
  let shortcuts = mergeShortcuts(overrides);

  function reloadProfiles() {
    overrides = loadOverrides();
    profiles = mergeProfiles(overrides);
    shortcuts = mergeShortcuts(overrides);
  }

  function getProfile(name: ProfileName): Profile | undefined {
    return profiles[name];
  }

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

  function saveProfileModel(name: ProfileName, provider: string, model: string, thinkingLevel: ThinkingLevel) {
    overrides.profiles ??= {};
    overrides.profiles[name] = {
      ...(overrides.profiles[name] ?? {}),
      provider,
      model,
      thinkingLevel,
    };
    saveOverrides(overrides);
    profiles = mergeProfiles(overrides);
  }

  function saveShortcut(name: ProfileName | "off", shortcut: string) {
    overrides.shortcuts ??= {};
    overrides.shortcuts[name] = shortcut;
    saveOverrides(overrides);
    shortcuts = mergeShortcuts(overrides);
  }

  async function applyProfile(name: ProfileName, ctx: ExtensionContext, persist = true): Promise<boolean> {
    reloadProfiles();
    const profile = getProfile(name);
    if (!profile) {
      ctx.ui.notify(`Profile "${name}" does not exist`, "error");
      return false;
    }

    const model = ctx.modelRegistry.find(profile.provider, profile.model);
    if (!model) {
      ctx.ui.notify(`Profile "${name}": model ${profile.provider}/${profile.model} is unavailable`, "error");
      return false;
    }

    if (!(await pi.setModel(model))) {
      ctx.ui.notify(`Profile "${name}": no credentials for ${profile.provider}/${profile.model}`, "error");
      return false;
    }

    captureBaseline(ctx);
    pi.setThinkingLevel(profile.thinkingLevel);

    const knownTools = new Set(pi.getAllTools().map((tool) => tool.name));
    const missingTools = profile.tools.filter((tool) => !knownTools.has(tool));
    pi.setActiveTools(profile.tools.filter((tool) => knownTools.has(tool)));
    if (missingTools.length > 0) {
      ctx.ui.notify(`Profile "${name}": unavailable tools: ${missingTools.join(", ")}`, "warning");
    }

    activeProfile = name;
    updateStatus(ctx);
    if (persist) pi.appendEntry("agent-profile-state", { name });
    ctx.ui.notify(`Profile "${name}" activated (${profile.model}, thinking:${profile.thinkingLevel})`, "info");
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

  function registerProfileCommand(name: BuiltInProfileName) {
    pi.registerCommand(name, {
      description: `Activate the ${name} profile`,
      handler: async (_args, ctx) => {
        await applyProfile(name, ctx);
      },
    });
  }

  for (const name of BUILT_IN_PROFILE_NAMES) registerProfileCommand(name);

  pi.registerCommand("profile", {
    description: "Manage profiles: /profile, /profile <name>, /profile set <name> <provider/model> <thinking>, /profile shortcut <name|off> <shortcut>, /profile off",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const [action, ...rest] = parts;

      if (!action) {
        reloadProfiles();
        const active = activeProfile ? `Active: ${activeProfile}` : "No profile is active";
        const available = Object.entries(profiles)
          .map(([name, profile]) => `${name}: ${profile.provider}/${profile.model} thinking:${profile.thinkingLevel}`)
          .join("\n");
        ctx.ui.notify(`${active}\n\nAvailable profiles:\n${available}\n\nShortcuts:\n${formatShortcuts(shortcuts)}\n\nConfig file: ${CONFIG_PATH}`, "info");
        return;
      }

      if (action === "off") {
        await deactivateProfiles(ctx);
        return;
      }

      if (action === "set") {
        const [name, modelRef, thinkingLevel] = rest;
        if (!name || !modelRef || !thinkingLevel || !isThinkingLevel(thinkingLevel)) {
          ctx.ui.notify(
            `Usage: /profile set <name> <provider/model> <thinking>\nThinking levels: ${THINKING_LEVELS.join(", ")}`,
            "error",
          );
          return;
        }
        const parsed = parseModelRef(modelRef);
        if (!parsed) {
          ctx.ui.notify("Model must use provider/model format, for example openai-codex/gpt-5.6-sol", "error");
          return;
        }
        saveProfileModel(name, parsed.provider, parsed.model, thinkingLevel);
        ctx.ui.notify(`Profile "${name}" saved as ${modelRef} with thinking:${thinkingLevel}`, "info");
        if (activeProfile === name) await applyProfile(name, ctx);
        return;
      }

      if (action === "shortcut") {
        const [name, shortcut] = rest;
        if (!name || !shortcut) {
          ctx.ui.notify("Usage: /profile shortcut <name|off> <shortcut>", "error");
          return;
        }
        saveShortcut(name, shortcut);
        ctx.ui.notify(`Shortcut for "${name}" saved as ${shortcut}. Reloading to apply it.`, "info");
        await ctx.reload();
        return;
      }

      if (action === "reset") {
        const [name] = rest;
        if (!name) {
          overrides = {};
        } else {
          delete overrides.profiles?.[name];
          delete overrides.shortcuts?.[name];
        }
        saveOverrides(overrides);
        profiles = mergeProfiles(overrides);
        shortcuts = mergeShortcuts(overrides);
        ctx.ui.notify(name ? `Profile "${name}" reset to defaults` : "All profile overrides reset", "info");
        return;
      }

      await applyProfile(action, ctx);
    },
  });

  pi.registerTool({
    name: "configure_profile",
    label: "Configure Profile",
    description: "Configure the model and thinking level used by a pi profile.",
    parameters: Type.Object({
      name: Type.String({ description: "Profile name, for example reviewer, planner, or coder" }),
      provider: Type.String({ description: "Model provider, for example openai-codex" }),
      model: Type.String({ description: "Model ID, for example gpt-5.6-sol" }),
      thinkingLevel: Type.Union(THINKING_LEVELS.map((level) => Type.Literal(level)), {
        description: "Thinking level for this profile",
      }),
    }),
    async execute(_toolCallId, params) {
      saveProfileModel(params.name, params.provider, params.model, params.thinkingLevel as ThinkingLevel);
      return {
        content: [
          {
            type: "text",
            text: `Profile "${params.name}" configured as ${params.provider}/${params.model} with thinking:${params.thinkingLevel}.`,
          },
        ],
        details: { configPath: CONFIG_PATH },
      };
    },
  });

  pi.registerTool({
    name: "configure_profile_shortcut",
    label: "Configure Profile Shortcut",
    description: "Configure the keyboard shortcut used by a pi profile. The new shortcut applies after reload.",
    parameters: Type.Object({
      name: Type.String({ description: "Profile name or off, for example reviewer, planner, coder, or off" }),
      shortcut: Type.String({ description: "Shortcut name, for example f6, f7, f8, or ctrl+shift+p" }),
    }),
    async execute(_toolCallId, params) {
      saveShortcut(params.name, params.shortcut);
      return {
        content: [
          {
            type: "text",
            text: `Shortcut for "${params.name}" configured as ${params.shortcut}. Reload pi to apply the new shortcut.`,
          },
        ],
        details: { configPath: CONFIG_PATH },
      };
    },
  });

  for (const [name, shortcut] of Object.entries(shortcuts)) {
    if (name === "off") {
      pi.registerShortcut(shortcut, { description: "Disable agent profile", handler: deactivateProfiles });
      continue;
    }
    pi.registerShortcut(shortcut, { description: `Activate ${name} profile`, handler: (ctx) => applyProfile(name, ctx) });
  }

  pi.on("before_agent_start", (event) => {
    if (!activeProfile) return;
    const profile = getProfile(activeProfile);
    if (!profile) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${profile.instructions}` };
  });

  pi.on("tool_call", (event) => {
    if (!activeProfile || !READ_ONLY_PROFILES.has(activeProfile)) return;
    const profile = getProfile(activeProfile);
    if (profile && !profile.tools.includes(event.toolName)) {
      return { block: true, reason: `${activeProfile} profile permits read-only tools only`, terminate: true };
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    reloadProfiles();
    const entries = ctx.sessionManager.getEntries();
    const savedBaseline = entries
      .filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === "agent-profile-baseline")
      .pop() as { data?: Baseline } | undefined;
    baseline = savedBaseline?.data;

    const saved = entries
      .filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === "agent-profile-state")
      .pop() as { data?: { name?: string | null } } | undefined;

    const name = saved?.data?.name;
    if (name && getProfile(name)) {
      await applyProfile(name, ctx, false);
    } else {
      updateStatus(ctx);
    }
  });
}
