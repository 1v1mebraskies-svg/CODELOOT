/**
 * Lightweight checks for save-queue serialization (no GitHub).
 */
import assert from 'assert';

let saveQueue = Promise.resolve();
let saveInFlight = false;
const order = [];

function enqueueSave(task) {
  const run = saveQueue.then(task);
  saveQueue = run.catch(() => {});
  return run;
}

async function saveGames(id) {
  return enqueueSave(async function () {
    saveInFlight = true;
    try {
      order.push('start-' + id);
      await new Promise((r) => setTimeout(r, 30));
      order.push('end-' + id);
      return id;
    } finally {
      saveInFlight = false;
    }
  });
}

const results = await Promise.all([saveGames(1), saveGames(2), saveGames(3)]);
assert.deepStrictEqual(results, [1, 2, 3]);
assert.deepStrictEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
console.log('save queue serialization: OK');
