import crypto from 'node:crypto'

export type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

/**
 * Проверяет подпись Telegram initData по алгоритму из официальной документации.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @returns распарсенный объект user, если подпись валидна; иначе null.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): TelegramUser | null {
  if (!initData) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  // data-check-string: пары key=value, отсортированные по ключу, через \n
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  // Сравнение в постоянном времени
  const a = Buffer.from(computedHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  // Проверка свежести (защита от replay старых initData)
  const authDate = Number(params.get('auth_date'))
  if (authDate) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate
    if (ageSeconds > maxAgeSeconds) return null
  }

  const userRaw = params.get('user')
  if (!userRaw) return null

  try {
    return JSON.parse(userRaw) as TelegramUser
  } catch {
    return null
  }
}
