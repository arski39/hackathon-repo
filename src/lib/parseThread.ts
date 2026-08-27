import { newId } from './id'
import type { Message } from '../types'

// Real pasted threads are a mess: forwarded headers, Gmail quote lines,
// WhatsApp exports, or just two paragraphs with a blank line between them.
// Be forgiving. A wrong split is recoverable; a crash is not.

const HEADER_PATTERNS: RegExp[] = [
  /^From:\s*(.+)$/i,
  /^On .+?,?\s*(.+?)\s*(?:<[^>]*>)?\s*wrote:$/i,
  /^(.+?)\s+wrote:$/i,
  // "[12.08, 14:32] Nina:" — WhatsApp-style export
  /^\[[^\]]+\]\s*([^:]{1,40}):$/,
  // "Nina Karhu:" on its own line
  /^([A-Za-zÀ-ÿ][\w'’\-. ]{1,38}):$/,
]

function matchHeader(line: string): string | null {
  for (const pattern of HEADER_PATTERNS) {
    const found = line.trim().match(pattern)
    if (found) return (found[1] ?? '').trim() || null
  }
  return null
}

type Block = { sender: string | null; lines: string[] }

/** Split raw pasted text into messages. Never throws, never returns []
 *  for non-empty input — worst case the whole paste is one message. */
export function parseThread(raw: string): Message[] {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const blocks: Block[] = []
  let current: Block = { sender: null, lines: [] }
  let sawBlank = false

  for (const line of text.split('\n')) {
    const sender = matchHeader(line)

    // A sender header always starts a new message.
    if (sender !== null || /^-{3,}\s*$/.test(line.trim())) {
      if (current.lines.length > 0) blocks.push(current)
      current = { sender, lines: [] }
      sawBlank = false
      continue
    }

    // Two blank lines, or one blank line before a long paragraph, is a
    // weaker signal — only split if we already have content.
    if (line.trim() === '') {
      sawBlank = true
      if (current.lines.length > 0) current.lines.push('')
      continue
    }

    if (sawBlank && current.lines.length > 0 && blocks.length === 0 && current.sender === null) {
      // Unlabelled paste: treat blank-line-separated paragraphs as turns.
      blocks.push(current)
      current = { sender: null, lines: [] }
    }
    sawBlank = false
    current.lines.push(line)
  }
  if (current.lines.length > 0) blocks.push(current)

  const cleaned = blocks
    .map((b) => ({ sender: b.sender, body: b.lines.join('\n').trim() }))
    .filter((b) => b.body !== '')

  if (cleaned.length === 0) {
    return [
      {
        id: newId('msg'),
        from: 'client',
        sender: 'Client',
        body: text,
        receivedAt: '',
      },
    ]
  }

  // Without explicit senders we can't know who is who, so alternate starting
  // with the client — the common case is "client asked, I replied". Named
  // senders are grouped: the same name is always the same side.
  const sideByName = new Map<string, 'client' | 'creator'>()
  return cleaned.map((block, index) => {
    let from: 'client' | 'creator'
    if (block.sender) {
      const key = block.sender.toLowerCase()
      if (!sideByName.has(key)) {
        sideByName.set(key, sideByName.size === 0 ? 'client' : 'creator')
      }
      from = sideByName.get(key)!
    } else {
      from = index % 2 === 0 ? 'client' : 'creator'
    }
    return {
      id: `msg_${index + 1}`,
      from,
      sender: block.sender ?? (from === 'client' ? 'Client' : 'You'),
      body: block.body,
      receivedAt: '',
    }
  })
}
