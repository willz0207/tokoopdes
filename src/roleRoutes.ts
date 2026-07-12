import type { UserRole } from './types'

export const homePathForRole = (role: UserRole) => {
  if (role === 'admin') return '/admin'
  if (role === 'manager') return '/manager'
  if (role === 'cashier') return '/cashier'
  return '/'
}
