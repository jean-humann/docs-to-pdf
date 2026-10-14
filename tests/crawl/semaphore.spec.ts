import { Semaphore } from '../../src/acquire';

/** Yield to the microtask/macrotask queue so other pending tasks can run. */
const tick = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe('Semaphore', () => {
  describe('construction validation', () => {
    it('throws RangeError on zero', () => {
      expect(() => new Semaphore(0)).toThrow(RangeError);
    });

    it('throws RangeError on a negative count', () => {
      expect(() => new Semaphore(-1)).toThrow(RangeError);
    });

    it('throws RangeError on a non-integer count', () => {
      expect(() => new Semaphore(1.5)).toThrow(RangeError);
    });

    it('accepts a positive integer count', () => {
      expect(() => new Semaphore(1)).not.toThrow();
      expect(() => new Semaphore(5)).not.toThrow();
    });
  });

  describe('mutual exclusion (count = 1)', () => {
    it('runs two acquirers strictly sequentially', async () => {
      const sem = new Semaphore(1);
      const events: string[] = [];

      const first = await sem.acquire();
      events.push('first:critical-start');

      // Second acquire must NOT resolve while the first permit is held.
      let secondStarted = false;
      const secondPromise = sem.acquire().then((release) => {
        secondStarted = true;
        events.push('second:critical-start');
        return release;
      });

      // Give the queued waiter a chance to (incorrectly) run.
      await tick();
      expect(secondStarted).toBe(false);
      expect(events).toEqual(['first:critical-start']);

      // Releasing the first permit must let the second proceed.
      events.push('first:release');
      first();

      const secondRelease = await secondPromise;
      expect(secondStarted).toBe(true);
      expect(events).toEqual([
        'first:critical-start',
        'first:release',
        'second:critical-start',
      ]);
      secondRelease();
    });
  });

  describe('bounded concurrency (count = 3, 7 tasks)', () => {
    it('never lets more than 3 run concurrently and finishes all', async () => {
      const sem = new Semaphore(3);
      const TASK_COUNT = 7;
      const completed: number[] = [];
      let inFlight = 0;
      let maxInFlight = 0;

      const tasks = Array.from({ length: TASK_COUNT }, (_, i) =>
        (async () => {
          const release = await sem.acquire();
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          // Hold the permit across an async boundary so overlap is observable.
          await tick();
          inFlight--;
          completed.push(i);
          release();
        })(),
      );

      await Promise.all(tasks);

      expect(maxInFlight).toBeLessThanOrEqual(3);
      expect(maxInFlight).toBeGreaterThan(1); // sanity: did overlap at all
      expect(completed.length).toBe(TASK_COUNT);
      expect(completed.slice().sort((a, b) => a - b)).toEqual([
        0, 1, 2, 3, 4, 5, 6,
      ]);
    });
  });

  describe('count greater than task count', () => {
    it('runs all tasks without deadlock', async () => {
      const sem = new Semaphore(10);
      const TASK_COUNT = 3;
      let inFlight = 0;
      let maxInFlight = 0;
      const completed: number[] = [];

      const tasks = Array.from({ length: TASK_COUNT }, (_, i) =>
        (async () => {
          const release = await sem.acquire();
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await tick();
          inFlight--;
          completed.push(i);
          release();
        })(),
      );

      await Promise.all(tasks);

      expect(completed.length).toBe(TASK_COUNT);
      // All three could run at once since permits exceed tasks.
      expect(maxInFlight).toBe(TASK_COUNT);
    });
  });

  describe('FIFO ordering (count = 1)', () => {
    it('grants waiters in the order they called acquire()', async () => {
      const sem = new Semaphore(1);
      const order: number[] = [];

      // Hold the only permit so the three waiters all queue up.
      const initial = await sem.acquire();

      // Each waiter records its id when granted, then releases so the next
      // FIFO waiter can proceed. The chain only completes if order is FIFO.
      const waiterPromises = [0, 1, 2].map((id) =>
        sem.acquire().then((release) => {
          order.push(id);
          release();
        }),
      );

      // Let the waiters enqueue. None should have run yet (permit is held).
      await tick();
      expect(order).toEqual([]);

      // Release the initial permit; waiters now drain one at a time in FIFO.
      initial();
      await Promise.all(waiterPromises);

      expect(order).toEqual([0, 1, 2]);
    });
  });

  describe('idempotent release', () => {
    it('does not over-grant when a release is called twice', async () => {
      const sem = new Semaphore(1);

      const release1 = await sem.acquire();

      // Three waiters queue behind the single permit.
      let ran2 = false;
      let ran3 = false;
      let ran4 = false;
      const p2 = sem.acquire().then((r) => {
        ran2 = true;
        return r;
      });
      const p3 = sem.acquire().then((r) => {
        ran3 = true;
        return r;
      });
      const p4 = sem.acquire().then((r) => {
        ran4 = true;
        return r;
      });

      await tick();
      expect([ran2, ran3, ran4]).toEqual([false, false, false]);

      // Release once: this wakes exactly ONE waiter (the first, FIFO).
      release1();
      // Call the SAME release again: must be a no-op, not a second permit.
      release1();

      await tick();
      // Only waiter #2 should have run; #3 and #4 must remain blocked because
      // the double release must not have granted an extra permit.
      const release2 = await p2;
      expect(ran2).toBe(true);
      expect(ran3).toBe(false);
      expect(ran4).toBe(false);

      // Draining proceeds normally one permit at a time afterwards.
      release2();
      const release3 = await p3;
      expect(ran3).toBe(true);
      expect(ran4).toBe(false);

      release3();
      const release4 = await p4;
      expect(ran4).toBe(true);
      release4();
    });
  });
});
