import { parseThread } from './parseThread'
import type { Message } from '../types'

/** parseThread always numbers from msg_1. Appending its output to an existing
 *  thread would collide, and a collided id sends every provenance line to the
 *  wrong message. */
function nextIndex(existing: Message[]): number {
  let highest = 0
  for (const message of existing) {
    const found = message.id.match(/^msg_(\d+)$/)
    if (found) highest = Math.max(highest, Number(found[1]))
  }
  return Math.max(highest, existing.length) + 1
}

/**
 * A later message from the client, parsed and renumbered so it can join the
 * record's thread — CLAUDE.md §6, Phase 2.
 *
 * Everything here is from the client. The screen is "add a message from the
 * client"; letting the parser alternate sides would silently attribute half of
 * a pasted follow-up to the user and flag their own words as a difference.
 */
export function parseFollowUp(raw: string, existing: Message[]): Message[] {
  const start = nextIndex(existing)
  return parseThread(raw).map((message, index) => ({
    ...message,
    id: `msg_${start + index}`,
    from: 'client' as const,
    sender: message.sender === 'You' ? 'Client' : message.sender,
  }))
}
