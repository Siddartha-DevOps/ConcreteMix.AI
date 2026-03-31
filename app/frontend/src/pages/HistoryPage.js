import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import {
  Cube, SignOut, ArrowLeft, ClockCounterClockwise,
  Flask, Funnel, MagnifyingGlass, Trash, ArrowsClockwise
} from '@phosphor-icons/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MATERIALS = ['cement', 'water', 'fly_ash', 'slag', 'fine_aggregate', 'coarse_aggregate', 'superplasticizer'];

export const HistoryPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selected, setSelected] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_URL}/api/history`, { withCredentials: true });
      setHistory(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/history/${id}`, { withCredentials: true });
      setHistory(history.filter(h => h.id !== id));
      if (selected?.id === id) setSelected(null);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Filter + sort
  const filtered = history
    .filter(h => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        h.predictions?.['28_day']?.toString().includes(s) ||
        new Date(h.created_at).toLocaleDateString().includes(s)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'strongest') return (b.predictions?.['28_day'] || 0) - (a.predictions?.['28_day'] || 0);
      if (sortBy === 'weakest') return (a.predictions?.['28_day'] || 0) - (b.predictions?.['28_day'] || 0);
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const strengthColor = (mpa) => {
    if (!mpa) return 'text-gray-500';
    if (mpa >= 40) return 'text-green-600';
    if (mpa >= 25) return 'text-orange-500';
    return 'text-red-500';
  };

  const strengthBadge = (mpa) => {
    if (!mpa) return { label: '—', cls: 'bg-gray-100 text-gray-500' };
    if (mpa >= 40) return { label: 'High', cls: 'bg-green-100 text-green-700' };
    if (mpa >= 25) return { label: 'Medium', cls: 'bg-orange-100 text-orange-700' };
    return { label: 'Low', cls: 'bg-red-100 text-red-700' };
  };

  const chartData = selected ? [
    { day: '7d', strength: selected.predictions?.['7_day'] },
    { day: '28d', strength: selected.predictions?.['28_day'] },
    { day: '56d', strength: selected.predictions?.['56_day'] },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
              <Cube size={20} weight="bold" className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">ConcreteMix AI</h1>
              <p className="text-xs text-orange-600 font-bold uppercase tracking-widest">Mix History</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <SignOut size={16} className="mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page title + stats */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClockCounterClockwise size={24} className="text-orange-500" />
              Prediction History
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {history.length} total prediction{history.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
          >
            <ArrowsClockwise size={16} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left — list */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search predictions..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="strongest">Strongest first</option>
                <option value="weakest">Weakest first</option>
              </select>
            </div>

            {/* Cards */}
            {loading ? (
              <div className="text-center py-16 text-gray-400">
                <ClockCounterClockwise size={32} className="mx-auto mb-3 animate-spin" />
                Loading history...
              </div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Flask size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No predictions found</p>
                <p className="text-sm text-gray-400 mt-1">Run a strength prediction to see it here</p>
                <Button className="mt-4" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {paginated.map((item) => {
                  const badge = strengthBadge(item.predictions?.['28_day']);
                  const isSelected = selected?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelected(isSelected ? null : item)}
                      className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-orange-400 shadow-md' : 'border-gray-100 hover:border-orange-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.label} Strength
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: '7-Day', val: item.predictions?.['7_day'] },
                              { label: '28-Day', val: item.predictions?.['28_day'] },
                              { label: '56-Day', val: item.predictions?.['56_day'] },
                            ].map(({ label, val }) => (
                              <div key={label}>
                                <p className="text-xs text-gray-400">{label}</p>
                                <p className={`font-mono font-bold text-lg ${strengthColor(val)}`}>
                                  {val ? `${val} MPa` : '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                          {item.water_cement_ratio && (
                            <p className="text-xs text-gray-400 mt-2">
                              W/C Ratio: <span className="font-mono font-medium text-gray-600">{item.water_cement_ratio}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {deleteConfirm === item.id ? (
                            <div className="flex gap-1">
                              <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                                className="text-xs bg-red-500 text-white px-2 py-1 rounded">Yes</button>
                              <button onClick={e => { e.stopPropagation(); setDeleteConfirm(null); }}
                                className="text-xs bg-gray-200 px-2 py-1 rounded">No</button>
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                              className="text-gray-300 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Right — detail panel */}
          <div className="lg:col-span-1">
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Flask size={18} className="text-orange-500" />
                  Prediction Detail
                </h3>

                {/* Strength chart */}
                <div className="mb-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Strength Over Time</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="day" style={{ fontSize: 11 }} />
                      <YAxis style={{ fontSize: 11 }} />
                      <Tooltip formatter={v => [`${v} MPa`, 'Strength']} />
                      <Line type="monotone" dataKey="strength" stroke="#FF5E00" strokeWidth={2} dot={{ fill: '#FF5E00', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Mix proportions */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Mix Proportions (kg/m³)</p>
                  <div className="space-y-2">
                    {MATERIALS.map(mat => {
                      const val = selected.mix_design?.[mat];
                      if (!val) return null;
                      return (
                        <div key={mat} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 capitalize">{mat.replace(/_/g, ' ')}</span>
                          <span className="font-mono font-medium text-gray-800">{val} kg</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
                  Recorded: {new Date(selected.created_at).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 sticky top-6">
                <Flask size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click a prediction to see its full details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};