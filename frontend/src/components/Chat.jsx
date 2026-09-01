import { useState, useEffect } from 'react';
import API from '../api';
import { Send, Loader } from 'lucide-react';

export default function Chat() {
  const [query, setQuery] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRequests(current => current.map(req => {
        if (req.status === 'IN_PROGRESS' || req.status === 'PENDING_APPROVAL') {
          API.get(`request/${req.id}/`).then(res => {
            if (res.data.status !== req.status) {
              updateRequestState(req.id, res.data.status);
            }
          });
        }
        return req;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateRequestState = (id, newStatus) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await API.post('request/', { query });
      setRequests([...requests, { id: res.data.request_id, query, status: res.data.status }]);
      setQuery('');
    } catch (err) {
      console.error(err);
      alert("Failed to send request. Check console.");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg bg-gray-50 p-4 shadow-sm">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {requests.map((req, idx) => (
          <div key={idx} className="bg-white p-4 rounded shadow-sm border">
            <p className="font-medium text-gray-800">User: {req.query}</p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Agent Status:</span> 
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                req.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                req.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {req.status}
              </span>
              {req.status === 'IN_PROGRESS' && <Loader className="w-4 h-4 animate-spin text-blue-500" />}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submitRequest} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., I need a transcript certificate..."
          className="flex-1 border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button disabled={loading} className="bg-blue-600 text-white p-3 rounded hover:bg-blue-700 transition-colors">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}