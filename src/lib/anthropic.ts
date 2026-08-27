import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  MAX_TOKENS,
  MODEL,
} from '../config'

export class ApiError extends Error {
  hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.hint = hint
  }
}

/**
 * One turn against the Messages API, straight from the browser.
 *
 * This is only acceptable because the key is the user's own and they pasted
 * it themselves — see the README. We never ship a key, and the key never
 * leaves this machine except to go to Anthropic.
 */
export async function complete(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  let response: Response
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(
      'Could not reach the API.',
      'Check your connection. If the network is unreliable, switch on Demo Mode — it needs no connection at all.',
    )
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let detail = body.slice(0, 300)
    try {
      const parsed = JSON.parse(body)
      detail = parsed?.error?.message ?? detail
    } catch {
      // Keep the raw text.
    }
    const hint =
      response.status === 401
        ? 'That key was rejected. Check it in Settings, or switch on Demo Mode.'
        : response.status === 429
          ? 'Rate limited. Wait a moment, or switch on Demo Mode.'
          : response.status >= 500
            ? 'The API is having trouble. Demo Mode still works.'
            : undefined
    throw new ApiError(`API returned ${response.status}: ${detail}`, hint)
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[]
  }
  const text = (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim()

  if (!text) throw new ApiError('The API returned an empty response.')
  return text
}
