// Journey: Login
// Criticality: high — it gates every other flow.
import { login } from '../helpers/auth.js';

export function loginJourney(user) {
  return login(user);
}
