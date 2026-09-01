import { useState, useEffect } from 'react';
import API from '../api';
import { CheckCircle, XCircle } from 'lucide-react';

export default function AdminPanel() {
  const [pending, setPending] = useState([]);

  useEffect(() => {
    fetchPending();
    // Poll for new approvals every 5 seconds
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try {
      const res = await API.get('pending/');
      setPending(res.data);
    } catch (err) {
      console.error("Failed to fetch pending actions", err);
    }
  };

  const processAction = async (id, action) => {
    try {
      const payload = { action, reason: action === 'REJECT' ? 'Admin denied the request due to policy.' : '' };
      await API.post(`${id}/process/`, payload);
      fetchPending(); 
    } catch (err) {
      console.error("Failed to process action", err);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm h-[600px] overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-600">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        HITL Approval Queue
      </h2>
      
      {pending.length === 0 ? (
        <div className="flex h-40 items-center justify-center border-2 border-dashed rounded text-gray-400">
          No actions require human approval right now.
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(item => (
            <div key={item.id} className="border border-red-200 bg-red-50 p-4 rounded-lg">
              <p className="mb-2"><strong className="text-gray-700">Original Query:</strong> {item.original_query}</p>
              <div className="bg-white p-3 rounded border text-sm font-mono">
                <span className="text-blue-600 font-bold">Intent:</span> {item.tool_name}<br/>
                <span className="text-purple-600 font-bold">Payload:</span> {JSON.stringify(item.tool_payload)}
              </div>
              <div className="mt-4 flex gap-3">
                <button 
                  onClick={() => processAction(item.id, 'APPROVE')}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium">
                  <CheckCircle className="w-5 h-5" /> Approve Action
                </button>
                <button 
                  onClick={() => processAction(item.id, 'REJECT')}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors font-medium">
                  <XCircle className="w-5 h-5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}