import { retrieveLaunchParams } from '@telegram-apps/sdk-react'
import { mockUser } from './mock'

// Данные пользователя, отображаемые в шапке профиля.
export type CurrentUser = {
  firstName: string
  lastName: string
  username: string
  avatar: string
}

function fromMock(): CurrentUser {
  return {
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    username: mockUser.username,
    avatar: mockUser.avatar,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(u: any): CurrentUser {
  return {
    firstName: u.first_name ?? u.firstName ?? '',
    lastName: u.last_name ?? u.lastName ?? '',
    username: u.username ?? '',
    avatar: u.photo_url ?? u.photoUrl ?? '',
  }
}

// Имя и аватар берём напрямую из Telegram. Вне Telegram (локальная
// разработка в браузере) — используем мок-данные.
export function getCurrentUser(): CurrentUser {
  // 1) Классический Telegram WebApp API (если доступен telegram-web-app.js)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user
    if (u) return normalize(u)
  } catch {
    /* вне Telegram — идём дальше */
  }

  // 2) Launch params из SDK @telegram-apps
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lp = retrieveLaunchParams() as any
    const u = lp?.tgWebAppData?.user ?? lp?.initData?.user
    if (u) return normalize(u)
  } catch {
    /* вне Telegram — идём дальше */
  }

  // 3) Фолбэк для браузера
  return fromMock()
}
