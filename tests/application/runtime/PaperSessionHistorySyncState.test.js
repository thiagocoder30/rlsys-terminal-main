const {
  PaperSessionHistorySyncState,
} = require('../../../dist/application/runtime/PaperSessionHistorySyncState.js');

describe('PaperSessionHistorySyncState', () => {
  test('starts unsynchronized', () => {
    const state = new PaperSessionHistorySyncState();

    const current = state.current();

    expect(current.status).toBe('UNSYNCED');
    expect(current.rounds).toEqual([]);
    expect(current.roundCount).toBe(0);
    expect(current.syncVersion).toBe(0);
  });

  test('stores first synchronized history snapshot', () => {
    const state = new PaperSessionHistorySyncState();

    const result = state.sync({
      rounds: [32, 15, 0, 19, 22, 7],
      synchronizedAtEpochMs: 1000,
    });

    expect(result.status).toBe('SYNCED');
    expect(result.rounds).toEqual([32, 15, 0, 19, 22, 7]);
    expect(result.roundCount).toBe(6);
    expect(result.syncVersion).toBe(1);
    expect(result.synchronizedAtEpochMs).toBe(1000);
  });

  test('resync replaces previous snapshot instead of concatenating', () => {
    const state = new PaperSessionHistorySyncState();

    state.sync({
      rounds: [1, 2, 3],
      synchronizedAtEpochMs: 1000,
    });

    const result = state.resync({
      rounds: [4, 5, 6, 7],
      synchronizedAtEpochMs: 2000,
    });

    expect(result.status).toBe('RESYNCED');
    expect(result.rounds).toEqual([4, 5, 6, 7]);
    expect(result.roundCount).toBe(4);
    expect(result.syncVersion).toBe(2);
    expect(result.synchronizedAtEpochMs).toBe(2000);
  });

  test('increments sync version on every resync', () => {
    const state = new PaperSessionHistorySyncState();

    state.sync({
      rounds: [1],
      synchronizedAtEpochMs: 1000,
    });

    state.resync({
      rounds: [2],
      synchronizedAtEpochMs: 2000,
    });

    const result = state.resync({
      rounds: [3],
      synchronizedAtEpochMs: 3000,
    });

    expect(result.syncVersion).toBe(3);
    expect(result.rounds).toEqual([3]);
  });

  test('rejects second sync when history is already synchronized', () => {
    const state = new PaperSessionHistorySyncState();

    state.sync({
      rounds: [1, 2, 3],
    });

    expect(() =>
      state.sync({
        rounds: [4, 5, 6],
      }),
    ).toThrow(
      'paper_session_history_already_synchronized',
    );
  });

  test('rejects resync before first sync', () => {
    const state = new PaperSessionHistorySyncState();

    expect(() =>
      state.resync({
        rounds: [1, 2, 3],
      }),
    ).toThrow(
      'paper_session_history_not_synchronized',
    );
  });

  test('rejects empty history snapshot', () => {
    const state = new PaperSessionHistorySyncState();

    expect(() =>
      state.sync({
        rounds: [],
      }),
    ).toThrow(
      'paper_session_history_empty',
    );
  });

  test('rejects roulette values outside zero through thirty six', () => {
    const state = new PaperSessionHistorySyncState();

    expect(() =>
      state.sync({
        rounds: [0, 36, 37],
      }),
    ).toThrow(
      'paper_session_history_invalid_round',
    );
  });
});
