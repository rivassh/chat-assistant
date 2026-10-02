import { useState, useEffect } from 'react';
import { api } from './api';

export function WidgetEditor({ widget, onBack, onEmbed }) {
  const [config, setConfig] = useState(widget.config || {});
  const [tab, setTab] = useState('personality');
  const [saving, setSaving] = useState(false);
  const [knowledge, setKnowledge] = useState([]);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', content: '', category: '' });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('7d');
  const [addKnowledgeMode, setAddKnowledgeMode] = useState(false);

  useEffect(() => {
    if (tab === 'knowledge') {
      api.knowledge.list(widget.id).then(d => setKnowledge(d.entries)).catch(console.error);
    }
    if (tab === 'analytics') {
      api.analytics.get(widget.id, analyticsPeriod).then(d => setAnalytics(d)).catch(console.error);
    }
  }, [tab, analyticsPeriod, widget.id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.widgets.update(widget.id, { config });
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (path, value) => {
    const parts = path.split('.');
    const newConfig = { ...config };
    let obj = newConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      obj[parts[i]] = { ...(obj[parts[i]] || {}) };
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setConfig(newConfig);
  };

  const addKnowledgeEntry = async () => {
    if (!newKnowledge.title || !newKnowledge.content) return;
    try {
      const data = await api.knowledge.create(widget.id, newKnowledge);
      setKnowledge([data.entry, ...knowledge]);
      setNewKnowledge({ title: '', content: '', category: '' });
      setAddKnowledgeMode(false);
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const deleteKnowledgeEntry = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await api.knowledge.delete(widget.id, id);
    setKnowledge(knowledge.filter(e => e.id !== id));
  };

  const tabs = [
    { id: 'personality', label: 'Personality' },
    { id: 'behavior', label: 'Behavior' },
    { id: 'ai', label: 'AI Settings' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'embed', label: 'Embed Code' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-600">&larr;</button>
            <h1 className="text-xl font-semibold">{widget.name}</h1>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono">{widget.slug}</span>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {tab === 'personality' && (
            <div className="space-y-5 max-w-xl">
              <h3 className="text-lg font-medium">Assistant Personality</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Name</label>
                <input
                  type="text"
                  value={config.personality?.name || ''}
                  onChange={(e) => updateConfig('personality.name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., Astra"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                <select
                  value={config.personality?.tone || 'friendly'}
                  onChange={(e) => updateConfig('personality.tone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="playful">Playful</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                <textarea
                  value={config.personality?.welcomeMessage || ''}
                  onChange={(e) => updateConfig('personality.welcomeMessage', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Hi! I'm here to help..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={config.appearance?.primaryColor || '#6366f1'}
                    onChange={(e) => updateConfig('appearance.primaryColor', e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.appearance?.primaryColor || '#6366f1'}
                    onChange={(e) => updateConfig('appearance.primaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shape</label>
                <select
                  value={config.appearance?.shape || 'circle'}
                  onChange={(e) => updateConfig('appearance.shape', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="circle">Circle</option>
                  <option value="half-circle">Half Circle (Bug)</option>
                  <option value="worm">Worm (Bug)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <select
                  value={config.appearance?.icon || 'initials'}
                  onChange={(e) => updateConfig('appearance.icon', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="initials">Initials</option>
                  <option value="bug">Bug</option>
                  <option value="worm">Worm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  value={config.appearance?.position || 'bottom-right'}
                  onChange={(e) => updateConfig('appearance.position', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="left-edge">Left Edge (Half Circle)</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.appearance?.animationsEnabled !== false}
                  onChange={(e) => updateConfig('appearance.animationsEnabled', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm font-medium text-gray-700">Enable animations</label>
              </div>
            </div>
          )}

          {tab === 'behavior' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Proactive Triggers</h3>
                <p className="text-sm text-gray-500 mb-4">Messages shown automatically based on user behavior.</p>
                {(config.behavior?.proactiveTriggers || []).map((trigger, i) => (
                  <div key={i} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-medium text-gray-400 w-20">{trigger.type}</span>
                    <span className="flex-1 text-sm text-gray-700">{trigger.message}</span>
                    <span className="text-xs text-gray-400">
                      {trigger.seconds && `${trigger.seconds}s`}
                      {trigger.percent && `${trigger.percent}%`}
                    </span>
                    <button
                      onClick={() => {
                        const triggers = [...(config.behavior?.proactiveTriggers || [])];
                        triggers.splice(i, 1);
                        updateConfig('behavior.proactiveTriggers', triggers);
                      }}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const triggers = [...(config.behavior?.proactiveTriggers || [])];
                    triggers.push({ type: 'time_on_page', seconds: 30, message: 'Need any help?' });
                    updateConfig('behavior.proactiveTriggers', triggers);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add trigger
                </button>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium mb-4">Page-Specific Rules</h3>
                <p className="text-sm text-gray-500 mb-4">Show messages when users visit specific pages.</p>
                {(config.behavior?.pageRules || []).map((rule, i) => (
                  <div key={i} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-mono text-indigo-600 w-32">{rule.urlPattern}</span>
                    <span className="flex-1 text-sm text-gray-700">{rule.message}</span>
                    <button
                      onClick={() => {
                        const rules = [...(config.behavior?.pageRules || [])];
                        rules.splice(i, 1);
                        updateConfig('behavior.pageRules', rules);
                      }}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const rules = [...(config.behavior?.pageRules || [])];
                    rules.push({ urlPattern: '/page', message: 'Need help with this page?' });
                    updateConfig('behavior.pageRules', rules);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add page rule
                </button>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-5 max-w-xl">
              <h3 className="text-lg font-medium">AI Configuration</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                <textarea
                  value={config.ai?.systemPrompt || ''}
                  onChange={(e) => updateConfig('ai.systemPrompt', e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  placeholder="You are a helpful website assistant..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.ai?.temperature || 0.7}
                    onChange={(e) => updateConfig('ai.temperature', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min="50"
                    max="2000"
                    step="50"
                    value={config.ai?.maxTokens || 200}
                    onChange={(e) => updateConfig('ai.maxTokens', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'knowledge' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Knowledge Base</h3>
                  <p className="text-sm text-gray-500">Add FAQs, text snippets, and page-specific help content.</p>
                </div>
                <button
                  onClick={() => setAddKnowledgeMode(!addKnowledgeMode)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  + Add Entry
                </button>
              </div>

              {addKnowledgeMode && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <input
                    type="text"
                    placeholder="Title (e.g., Shipping Policy)"
                    value={newKnowledge.title}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <textarea
                    placeholder="Content (the answer/knowledge)"
                    value={newKnowledge.content}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Category (optional)"
                    value={newKnowledge.category}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={addKnowledgeEntry} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Save</button>
                    <button onClick={() => setAddKnowledgeMode(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {knowledge.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No knowledge entries yet.</p>
                  <p className="text-sm mt-1">Add FAQs, help content, or documentation snippets.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledge.map(entry => (
                    <div key={entry.id} className="p-4 bg-gray-50 rounded-lg flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 text-sm">{entry.title}</h4>
                          {entry.category && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{entry.category}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{entry.content}</p>
                      </div>
                      <button
                        onClick={() => deleteKnowledgeEntry(entry.id)}
                        className="text-red-400 hover:text-red-600 text-sm flex-shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Usage Analytics</h3>
                <select
                  value={analyticsPeriod}
                  onChange={(e) => setAnalyticsPeriod(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>

              {analytics ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-bold text-gray-900">{analytics.totalConversations}</div>
                    <div className="text-sm text-gray-500">Conversations</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-bold text-gray-900">{analytics.uniqueVisitors}</div>
                    <div className="text-sm text-gray-500">Unique Visitors</div>
                  </div>
                  {Object.entries(analytics.events || {}).map(([key, val]) => (
                    <div key={key} className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{val}</div>
                      <div className="text-sm text-gray-500">{key}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">Loading analytics...</div>
              )}
            </div>
          )}

          {tab === 'embed' && (
            <div className="space-y-6 max-w-xl">
              <h3 className="text-lg font-medium">Embed on your website</h3>
              <p className="text-sm text-gray-500">Add this script tag to your website's HTML, just before the closing &lt;/body&gt; tag.</p>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-green-400 whitespace-pre">&lt;script
  src="https://cdn.siteassistant.io/widget.js"
  data-widget-id="{widget.slug}"
  data-api-url="https://api.siteassistant.io"
  async
  defer
&gt;&lt;/script&gt;</code>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                <strong>Widget ID:</strong> <code className="font-mono">{widget.slug}</code>
              </div>
              <div className="text-sm text-gray-500 space-y-2">
                <p>The widget will:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Load asynchronously without blocking your page</li>
                  <li>Isolate its styles using Shadow DOM</li>
                  <li>Display your configured assistant in the corner</li>
                  <li>Proactively engage visitors based on your rules</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
