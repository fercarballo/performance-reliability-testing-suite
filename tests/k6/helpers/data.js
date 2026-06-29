// Loads the synthetic users once per VU-pool via SharedArray (memory-efficient)
// and hands them out so VUs do not all hammer the same account.
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', () => {
  const text = open('../data/users.csv');
  return text
    .trim()
    .split('\n')
    .slice(1) // drop header
    .map((line) => {
      const [username, password, customerId] = line.split(',');
      return { username, password, customerId };
    });
});

export function pickUser() {
  // Spread load across the dataset based on VU + iteration.
  return users[(__VU * 7 + __ITER) % users.length];
}

export function userCount() {
  return users.length;
}
