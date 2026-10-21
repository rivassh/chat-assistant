import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { WidgetList } from './WidgetList';
import { WidgetEditor } from './WidgetEditor';
import { CreateWidgetDialog } from './CreateWidgetDialog';
import { LiveInbox } from './LiveInbox';

function Dashboard() {
  const { user, logout } = useAuth();
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [liveWidget, setLiveWidget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  if (!user) return <LoginPage />;

  if (liveWidget) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
            <button onClick={() => setLiveWidget(null)} className="text-gray-400 hover:text-gray-600">&larr;</button>
            <h1 className="text-xl font-semibold">{liveWidget.name}</h1>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono">{liveWidget.slug}</span>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-6">
          <LiveInbox
            widgetId={liveWidget.id}
            onClose={() => setLiveWidget(null)}
          />
        </div>
      </div>
    );
  }

  if (selectedWidget) {
    return (
      <WidgetEditor
        widget={selectedWidget}
        onBack={() => setSelectedWidget(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Site Assistant</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </nav>

      <WidgetList
        onSelect={setSelectedWidget}
        onCreate={() => setShowCreate(true)}
        onLive={setLiveWidget}
      />

      {showCreate && (
        <CreateWidgetDialog
          onCreated={(widget) => { setShowCreate(false); setSelectedWidget(widget); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
