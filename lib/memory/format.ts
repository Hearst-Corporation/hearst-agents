/**
 * Conversation Memory — formatting helpers.
 *
 * Produces a compact text representation for injection into prompts.
 */

import type { ChatMessageMemory } from "./types";



export function memoryToConversationHistory(
  messages: ChatMessageMemory[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content:
      m.content.length > 1200 ? m.content.slice(0, 1200) + "…" : m.content,
  }));
}
