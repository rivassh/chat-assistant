import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDOFF_EVENT,
  publishHandoffEvent,
  subscribeToWidget,
} from '../src/lib/handoff-bus.js';

describe('handoff bus', () => {
  test('delivers an event to a subscriber of the same widget', () => {
    const received = [];
    const unsubscribe = subscribeToWidget('widget-a', ({ event, payload }) => {
      received.push({ event, payload });
    });

    publishHandoffEvent('widget-a', HANDOFF_EVENT.NEW, { visitorId: 'v1' });
    unsubscribe();

    assert.equal(received.length, 1);
    assert.equal(received[0].event, 'handoff_new');
    assert.equal(received[0].payload.visitorId, 'v1');
  });

  test('does not leak events across widgets', () => {
    const received = [];
    const unsubscribe = subscribeToWidget('widget-a', (e) => received.push(e));

    publishHandoffEvent('widget-b', HANDOFF_EVENT.OPERATOR_MESSAGE, { visitorId: 'v2' });
    unsubscribe();

    assert.equal(received.length, 0, 'another widget must not receive the event');
  });

  test('unsubscribe stops delivery', () => {
    const received = [];
    const unsubscribe = subscribeToWidget('widget-a', (e) => received.push(e));

    publishHandoffEvent('widget-a', HANDOFF_EVENT.NEW, {});
    unsubscribe();
    publishHandoffEvent('widget-a', HANDOFF_EVENT.NEW, {});

    assert.equal(received.length, 1);
  });

  test('every subscriber of a widget receives the event', () => {
    const first = [];
    const second = [];
    const unsubFirst = subscribeToWidget('widget-a', (e) => first.push(e));
    const unsubSecond = subscribeToWidget('widget-a', (e) => second.push(e));

    publishHandoffEvent('widget-a', HANDOFF_EVENT.VISITOR_MESSAGE, { content: 'hi' });
    unsubFirst();
    unsubSecond();

    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
  });

  test('event names match the ones the clients listen for', () => {
    assert.equal(HANDOFF_EVENT.NEW, 'handoff_new');
    assert.equal(HANDOFF_EVENT.UPDATE, 'handoff_update');
    assert.equal(HANDOFF_EVENT.ENDED, 'handoff_ended');
    assert.equal(HANDOFF_EVENT.OPERATOR_MESSAGE, 'operator_message');
    assert.equal(HANDOFF_EVENT.VISITOR_MESSAGE, 'visitor_message');
  });
});
