import { useState, useEffect } from 'react';
import { api } from './api';

export function WidgetList({ onSelect, onCreate, onLive }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.widgets.list()
      .then(data => setWidgets(data.widgets))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading widgets...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Assistants</h1>
          <p className="text-gray-500 mt-1">Manage your website assistants</p>
        </div>
        <button
          onClick={onCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Assistant
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assistants yet</h3>
          <p className="text-gray-500 mb-4">Create your first AI assistant to get started</p>
          <button
            onClick={onCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Create Assistant
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.map(widget => (
            <div
              key={widget.id}
              onClick={() => onSelect(widget)}
              className="p-6 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: widget.config?.appearance?.primaryColor || '#6366f1' }}
                >
                  {(widget.config?.personality?.name || widget.name).charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{widget.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{widget.slug}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {widget.config?.personality?.name || 'Assistant'} &middot; {widget.config?.personality?.tone || 'friendly'}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Created {new Date(widget.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onLive?.(widget); }}
                  className="px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Live Inbox
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
