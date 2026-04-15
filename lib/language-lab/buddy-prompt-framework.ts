/**
 * @deprecated — This file is a backward-compatibility shim.
 * Import from "@/lib/language-lab/prompt-framework" instead.
 * All types and functions are re-exported from the new module.
 */
export {
  // Legacy type aliases
  type BuddyPromptScope,
  type BuddyPromptMode,
  type BuddyPromptIssueSeverity,
  type BuddyPromptSectionDefinition,
  type BuddyPromptDocument,
  type BuddyPromptLintIssue,
  type BuddyPromptCapabilityState,
  type BuddyPromptPreviewPersona,
  // Legacy function wrappers
  getBuddyPromptSectionDefinitions,
  createDefaultBuddyPromptDocument,
  encodeBuddyPromptDocument,
  createStructuredBuddyPromptValue,
  parseBuddyPromptDocument,
  countCompletedBuddyPromptSections,
  compileBuddyPromptDocument,
  resolveCompiledBuddyPromptValue,
  lintBuddyPromptValue,
  buildBuddyRuntimePromptPreview,
} from "./prompt-framework";