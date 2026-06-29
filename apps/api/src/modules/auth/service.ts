import { query } from '../../database/pool';
import { verifyPassword } from '../../security/password';

export interface AuthedUser {
  userId: string;
  customerId: string;
}

interface UserRow {
  id: string;
  customer_id: string;
  password_hash: string;
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthedUser | null> {
  const rows = await query<UserRow>(
    'SELECT id, customer_id, password_hash FROM users WHERE username = $1',
    [username],
  );
  const user = rows[0];
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return { userId: user.id, customerId: user.customer_id };
}
