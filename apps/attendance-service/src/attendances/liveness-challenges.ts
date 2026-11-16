import { randomUUID } from 'node:crypto';

export type HeadTurn = 'LEFT' | 'RIGHT';

interface Challenge {
  employeeId: number;
  steps: HeadTurn[];
  createdAt: number;
}

// A challenge can be used up to 10 minutes after it was created
// (the employee may still write the agenda after the face check)...
const MAX_AGE_MS = 10 * 60 * 1000;
// ...but not sooner than 1.5 seconds: turning the head twice takes longer.
const MIN_AGE_MS = 1500;

// Liveness check: before a camera check-in the browser asks for a
// challenge. The server picks the order of the head turns at random
// (left then right, or right then left), so a recorded video of an
// earlier check-in does not fit. Each challenge can be used once.
//
// Kept in memory: a challenge only lives for 10 minutes, so losing them
// on a restart just means the employee starts the face check again.
export class LivenessChallenges {
  private readonly challenges = new Map<string, Challenge>();

  create(employeeId: number) {
    this.removeExpired();

    const steps: HeadTurn[] = Math.random() < 0.5 ? ['LEFT', 'RIGHT'] : ['RIGHT', 'LEFT'];
    const id = randomUUID();
    const createdAt = Date.now();

    this.challenges.set(id, { employeeId, steps, createdAt });

    return {
      challengeId: id,
      steps,
      expiresAt: new Date(createdAt + MAX_AGE_MS),
    };
  }

  // Returns an error message, or null when the challenge is valid.
  // A valid challenge is removed, so it cannot be used again.
  use(id: string | undefined, employeeId: number): string | null {
    const challenge = id ? this.challenges.get(id) : undefined;

    if (!id || !challenge || challenge.employeeId !== employeeId) {
      return 'The face check is missing or was already used. Please do it again.';
    }

    const age = Date.now() - challenge.createdAt;

    if (age > MAX_AGE_MS) {
      this.challenges.delete(id);
      return 'The face check took too long. Please do it again.';
    }

    if (age < MIN_AGE_MS) {
      return 'The face check was finished too quickly. Please do it again.';
    }

    this.challenges.delete(id);
    return null;
  }

  private removeExpired() {
    const now = Date.now();

    for (const [id, challenge] of this.challenges) {
      if (now - challenge.createdAt > MAX_AGE_MS) {
        this.challenges.delete(id);
      }
    }
  }
}
