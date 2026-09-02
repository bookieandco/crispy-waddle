import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_COMMERCIAL_DATA_BOUNDARY,
  learnFromInteraction,
  type PersonalLearningSignal,
  type UserInteractionEvent,
} from './index';

test('commercial apps can teach personal Jhadina from user interaction signals', async () => {
  const received: PersonalLearningSignal[] = [];
  const event: UserInteractionEvent = {
    eventId: 'evt_1',
    userId: 'user_1',
    appId: 'truckeros',
    type: 'route.preference.observed',
    occurredAt: '2026-08-31T12:00:00.000Z',
    signal: { preference: 'avoid-tolls' },
    source: 'user-interaction',
  };

  const learned = await learnFromInteraction(event, DEFAULT_COMMERCIAL_DATA_BOUNDARY, {
    ingest: (signal) => received.push(signal),
  });

  assert.equal(learned, true);
  assert.equal(received.length, 1);
  assert.equal(received[0]?.appId, 'truckeros');
  assert.equal(received[0]?.userId, 'user_1');
});

test('learning is disabled when an app opts out of observing interactions', async () => {
  const received: PersonalLearningSignal[] = [];
  const event: UserInteractionEvent = {
    eventId: 'evt_2',
    userId: 'user_1',
    appId: 'truckeros',
    type: 'route.preference.observed',
    occurredAt: '2026-08-31T12:00:00.000Z',
    source: 'user-interaction',
  };

  const learned = await learnFromInteraction(event, {
    ...DEFAULT_COMMERCIAL_DATA_BOUNDARY,
    learning: {
      ...DEFAULT_COMMERCIAL_DATA_BOUNDARY.learning,
      observeUserInteractions: false,
    },
  }, {
    ingest: (signal) => received.push(signal),
  });

  assert.equal(learned, false);
  assert.equal(received.length, 0);
});
