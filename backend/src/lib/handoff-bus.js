import { EventEmitter } from 'events';

const bus = new EventEmitter();
bus.setMaxListeners(0);

export const HANDOFF_EVENT = {
  NEW: 'handoff_new',
  UPDATE: 'handoff_update',
  ENDED: 'handoff_ended',
  OPERATOR_MESSAGE: 'operator_message',
  VISITOR_MESSAGE: 'visitor_message',
};

export function publishHandoffEvent(widgetId, event, payload) {
  bus.emit(`widget:${widgetId}`, { event, payload });
}

export function subscribeToWidget(widgetId, listener) {
  const channel = `widget:${widgetId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

// Seam for an external push channel (Telegram / WhatsApp / email).
// The dashboard SSE inbox is the only channel wired up for now.
export async function notifyHandoff(handoff) {
  return false;
}
