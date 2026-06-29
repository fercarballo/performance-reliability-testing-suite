// The end-to-end self-care flow, reused by every scenario so load profiles
// differ only in their executor/stages — never in what a user actually does.
import { sleep } from 'k6';
import { pickUser } from './data.js';
import { loginJourney } from '../journeys/login.js';
import { invoiceLookupJourney } from '../journeys/invoice-lookup.js';
import { planChangeJourney } from '../journeys/plan-change.js';
import { paymentJourney } from '../journeys/payment.js';

export function selfCareFlow({ think = 1 } = {}) {
  const user = pickUser();

  const token = loginJourney(user);
  if (!token) {
    if (think) sleep(think);
    return;
  }

  invoiceLookupJourney(token, user);
  planChangeJourney(token, user);
  paymentJourney(token, user);

  if (think) sleep(think);
}
