import { useState, useEffect, useRef } from 'react';
import { api } from './api';

const isVisitor = (role) => role === 'visitor' || role === 'user';

export function LiveInbox({ widgetId, onClose }) {
  const [handoff, setHandoff] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [ended, setEnded] = useState(false);
  const messagesEndRef = useRef(null);
  // The SSE listeners are registered once, so the active handoff is read from a
  // ref — reading it from the state closure would capture the first render's
  // value (null) and silently drop every event.
  const activeRef = useRef(null);

  const loadLatest = async () => {
    const d = await api.handoffs.list(widgetId);
    const list = d.handoffs || [];
    if (!list.length) {
      activeRef.current = null;
      setHandoff(null);
      setMessages([]);
      return;
    }
    const h = list[0];
    const changed = activeRef.current?.id !== h.id;
    activeRef.current = { id: h.id, visitorId: h.visitorId, conversationId: h.conversationId };
    setHandoff(h);
    setMessages(h.thread || []);
    if (changed) setEnded(false);
  };

  useEffect(() => {
    loadLatest().catch(console.error);

    const token = localStorage.getItem('sa_token');
    const stream = api.handoffs.stream(widgetId, token);

    // A new handoff for this widget: adopt it and reload its thread.
    stream.addEventListener('handoff_new', () => {
      loadLatest().catch(console.error);
    });

    const append = (e) => {
      let payload = {};
      try { payload = JSON.parse(e.data); } catch {}
      const active = activeRef.current;
      if (!active || payload.handoffId !== active.id) return;
      const msg = payload.message;
      if (!msg) return;
      setMessages(prev => (
        prev.some((m) => m.role === msg.role && m.timestamp === msg.timestamp)
          ? prev
          : [...prev, msg]
      ));
    };

    stream.addEventListener('operator_message', append);
    stream.addEventListener('visitor_message', append);

    stream.addEventListener('handoff_ended', (e) => {
      let payload = {};
      try { payload = JSON.parse(e.data); } catch {}
      const active = activeRef.current;
      if (!active || payload.handoffId !== active.id) return;
      setEnded(true);
      stream.close();
    });

    return () => { stream.close(); };
  }, [widgetId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = async () => {
    if (!replyText.trim() || !handoff) return;
    try {
      const data = await api.handoffs.reply(widgetId, handoff.id, replyText);
      const msg = data.message;
      if (msg) {
        setMessages(prev => (
          prev.some((m) => m.role === msg.role && m.timestamp === msg.timestamp)
            ? prev
            : [...prev, msg]
        ));
      }
      setReplyText('');
    } catch (err) {
      console.error('Reply failed:', err);
    }
  };

  const handleEnd = async () => {
    if (!handoff) return;
    if (!confirm('End the human takeover? The visitor can now ask the AI.')) return;
    try {
      await api.handoffs.end(widgetId, handoff.id);
      setEnded(true);
    } catch (err) {
      console.error('End failed:', err);
    }
  };

  if (!handoff) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No active human handoffs.</p>
        <p className="text-sm mt-2">Visitors who click &quot;Talk to a human&quot; will appear here.</p>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg font-medium mb-4">Handoff completed</p>
        <p className="text-sm text-gray-500">The human has taken over and ended the conversation.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">Live Inbox</h3>
            <p className="text-sm text-gray-500">Visitor: {handoff.visitorId?.slice(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-64 overflow-y-auto p-3 bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400">Waiting for messages...</p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`mb-2 flex ${isVisitor(msg.role) ? 'justify-end' : 'justify-start'}`}>
                  <span className={`px-2 py-1 rounded text-sm ${
                    isVisitor(msg.role) ? 'bg-blue-100 text-blue-800' :
                    msg.role === 'operator' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.role === 'operator' && <strong>Support: </strong>}
                    {msg.content}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={2}
            placeholder="Your reply..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
          <button
            onClick={handleReply}
            disabled={!replyText.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleEnd}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            End Takeover
          </button>
        </div>
      </div>
    </div>
  );
}
