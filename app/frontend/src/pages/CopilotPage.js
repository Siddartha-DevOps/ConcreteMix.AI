import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Cube, PaperPlaneRight, ArrowLeft, Trash,
  Robot, User, Spinner, Download, ChartBar,
  CheckCircle, WarningCircle
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SUGGESTIONS = [
  "Design M40 concrete with 20% fly ash and lowest cost",
  "Predict strength for 350kg cement, 185kg water, 80kg fly ash",
  "What is the carbon footprint of M30 with 30% slag?",
  "Compare M35 with fly ash vs standard OPC mix",
  "Explain water-cement ratio",
  "Design M25 concrete for a slab with minimum carbon",
];

const MixTable = ({ mix }) => {
  if (!mix) return null;
  const labels = {
    cement: 'Cement', water: 'Water', fly_ash: 'Fly Ash',
    slag: 'Slag', fine_aggregate: 'Fine Aggregate',
    coarse_aggregate: 'Coarse Aggregate', superplasticizer: 'Superplasticizer'
  };
  return (
    <div className="mt-3 border border-orange-200 rounded-lg overflow-hidden text-xs">
      <div className="bg-orange-50 px-3 py-2 font-semibold text-orange-800 text-xs uppercase tracking-wider">
        Mix Proportions (kg/m³)
      </div>
      <table className="w-full">
        <tbody>
          {Object.entries(mix).filter(([, v]) => v > 0).map(([k, v]) => (
            <tr key={k} className="border-t border-orange-100">
              <td className="px-3 py-1.5 text-gray-600">{labels[k] || k}</td>
              <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-800">{v} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StrengthCards = ({ data }) => {
  if (!data?.strength_28day) return null;
  const meets = data.meets_target;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
      {[
        { label: '7-Day', val: data.strength_7day },
        { label: '28-Day', val: data.strength_28day, primary: true },
        { label: '56-Day', val: data.strength_56day },
      ].map(({ label, val, primary }) => (
        <div key={label} className={`rounded-lg p-2 text-center border ${primary ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="text-gray-500 mb-0.5">{label}</div>
          <div className={`font-mono font-bold text-base ${primary ? 'text-orange-600' : 'text-gray-700'}`}>
            {val} MPa
          </div>
        </div>
      ))}
      <div className="col-span-3 flex items-center gap-4 text-xs text-gray-500 pt-1">
        <span>W/C: <span className="font-mono font-semibold text-gray-700">{data.water_cement_ratio}</span></span>
        <span>Cost: <span className="font-mono font-semibold text-gray-700">${data.total_cost}/m³</span></span>
        <span>CO₂: <span className="font-mono font-semibold text-gray-700">{data.total_carbon} kg/m³</span></span>
        {data.cost_saved > 0 && (
          <span className="text-green-600 font-semibold">Saves ${data.cost_saved}/m³</span>
        )}
      </div>
    </div>
  );
};

const StepsAccordion = ({ steps }) => {
  const [open, setOpen] = useState(false);
  if (!steps || steps.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium"
      >
        <ChartBar size={13} />
        {open ? 'Hide' : 'Show'} reasoning ({steps.length} steps)
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {steps.map((s) => (
            <div key={s.step_num} className="flex gap-2.5 text-xs">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                {s.step_num}
              </div>
              <div>
                <div className="font-semibold text-gray-700">{s.title}</div>
                <div className="text-gray-500 mt-0.5 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: s.detail.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MessageBubble = ({ msg, onDownloadReport }) => {
  const isAgent = msg.role === 'agent';
  const formattedContent = (msg.content || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  return (
    <div className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
        isAgent ? 'bg-orange-500' : 'bg-gray-200'
      }`}>
        {isAgent
          ? <Robot size={16} className="text-white" weight="fill" />
          : <User size={16} className="text-gray-600" weight="fill" />
        }
      </div>

      <div className={`max-w-[80%] ${isAgent ? '' : 'items-end flex flex-col'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isAgent
            ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
            : 'bg-orange-500 text-white rounded-tr-sm'
        }`}>
          <div dangerouslySetInnerHTML={{ __html: formattedContent }} />

          {isAgent && msg.data?.mix_data && <MixTable mix={msg.data.mix_data} />}
          {isAgent && msg.data?.strength_28day && <StrengthCards data={msg.data} />}
          {isAgent && msg.steps?.length > 0 && <StepsAccordion steps={msg.steps} />}

          {isAgent && msg.data?.strength_28day && (
            <button
              onClick={() => onDownloadReport(msg)}
              className="mt-3 flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-50 transition-colors"
            >
              <Download size={13} /> Download Trial Mix Report
            </button>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1 px-1">
          {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
      <Robot size={16} className="text-white" weight="fill" />
    </div>
    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex gap-1 items-center h-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-orange-400"
            style={{ animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
    <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
  </div>
);

export const CopilotPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/copilot/history`, { withCredentials: true });
      if (data.length > 0) {
        setMessages(data.map(m => ({
          ...m,
          content: m.content || m.message || '',
          data: m.data || {},
          steps: m.steps || []
        })));
      } else {
        setMessages([{
          id: 'welcome',
          role: 'agent',
          content: "Hello! I'm **ConcreteMix Copilot** — your AI assistant for concrete mix design.\n\nTry asking me something like:\n*\"Design M40 concrete with 20% fly ash and lowest cost\"*",
          steps: [],
          data: {},
          created_at: new Date().toISOString()
        }]);
      }
    } catch {
      setMessages([{
        id: 'welcome',
        role: 'agent',
        content: "Hello! I'm **ConcreteMix Copilot**. How can I help you design concrete today?",
        steps: [],
        data: {},
        created_at: new Date().toISOString()
      }]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setError('');

    const userMsg = {
      id: Date.now() + '-user',
      role: 'user',
      content: msg,
      steps: [],
      data: {},
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${API_URL}/api/copilot/chat`,
        { message: msg },
        { withCredentials: true }
      );

      const agentMsg = {
        id: Date.now() + '-agent',
        role: 'agent',
        content: data.message,
        steps: data.steps || [],
        data: data.data || {},
        mix_data: data.mix_data,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear all conversation history?')) return;
    await axios.delete(`${API_URL}/api/copilot/history`, { withCredentials: true });
    setMessages([{
      id: 'welcome',
      role: 'agent',
      content: "Conversation cleared. How can I help you with your next mix design?",
      steps: [],
      data: {},
      created_at: new Date().toISOString()
    }]);
  };

  const downloadReport = async (msg) => {
    const data = msg.data || {};
    const mix = msg.mix_data || data.mix_design || {};

    const content = `
CONCRETEMIX AI — TRIAL MIX REPORT
===================================
Generated: ${new Date().toLocaleString()}
Engineer:  ${user?.name} | ${user?.company || ''}

MIX PROPORTIONS (kg/m³)
------------------------
Cement:           ${mix.cement || '—'} kg
Water:            ${mix.water || '—'} kg
Fly Ash:          ${mix.fly_ash || 0} kg
Slag (GGBS):      ${mix.slag || 0} kg
Fine Aggregate:   ${mix.fine_aggregate || '—'} kg
Coarse Aggregate: ${mix.coarse_aggregate || '—'} kg
Superplasticizer: ${mix.superplasticizer || 0} kg

PREDICTED STRENGTH
------------------
7-Day:  ${data.strength_7day || '—'} MPa
28-Day: ${data.strength_28day || '—'} MPa
56-Day: ${data.strength_56day || '—'} MPa

WATER-CEMENT RATIO: ${data.water_cement_ratio || '—'}

COST & CARBON
-------------
Total Cost:    $${data.total_cost || '—'} per m³
Cost Savings:  $${data.cost_saved || 0} per m³ vs OPC baseline
Carbon:        ${data.total_carbon || '—'} kg CO₂/m³
Carbon Saved:  ${data.carbon_saved || 0} kg CO₂/m³

Generated by ConcreteMix AI Copilot
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial_mix_report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
            <Cube size={20} weight="bold" className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900">ConcreteMix Copilot</h1>
              <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-xs text-gray-500">Your AI concrete mix design assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={15} /> Dashboard
          </button>
          <button onClick={clearHistory}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">
            <Trash size={15} /> Clear
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div className="max-w-3xl mx-auto space-y-5">
          {historyLoading ? (
            <div className="text-center text-gray-400 py-8">
              <Spinner size={24} className="animate-spin mx-auto mb-2" />
              Loading conversation...
            </div>
          ) : (
            messages.map(msg => (
              <MessageBubble key={msg.id || msg._id || Math.random()} msg={msg} onDownloadReport={downloadReport} />
            ))
          )}
          {loading && <TypingIndicator />}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <WarningCircle size={16} weight="fill" /> {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestions (shown when only welcome message) */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything... e.g. Design M40 with 20% fly ash and lowest cost"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-12 h-12 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            {loading
              ? <Spinner size={18} className="animate-spin" />
              : <PaperPlaneRight size={18} weight="fill" />
            }
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};