import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
export function validResetPassword(password, configured = process.env.RESET_PASSWORD) {
  return typeof configured === 'string' && configured.length >= 12 &&
    typeof password === 'string' && timingSafeEqual(digest(password), digest(configured));
}
