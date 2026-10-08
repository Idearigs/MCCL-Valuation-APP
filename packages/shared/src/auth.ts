import { z } from 'zod';

export const PIN_REGEX = /^\d{4,8}$/;

export const pinLoginSchema = z.object({
  pin: z.string().regex(PIN_REGEX, 'PIN must be 4–8 digits'),
});

export const changePinSchema = z.object({
  currentPin: z.string().regex(PIN_REGEX, 'PIN must be 4–8 digits'),
  newPin: z.string().regex(PIN_REGEX, 'PIN must be 4–8 digits'),
});

export type Role = 'admin' | 'staff';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthStatus {
  /** Signed-in user, or null. */
  user: SessionUser | null;
  /** Configured PIN length so the keypad knows when to auto-submit. */
  pinLength: number;
}
