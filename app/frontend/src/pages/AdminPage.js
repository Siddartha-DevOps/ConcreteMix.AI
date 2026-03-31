import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import {
  Cube, SignOut, Users, ChartBar, Trash, MagnifyingGlass,
  ArrowLeft, ShieldCheck, UserCircle, Buildings
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AdminPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/stats`, { withCredentials: true }),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${API_URL}/api/admin/users/${userId}`, { withCredentials: true });
      setUsers(users.filter(u => u.id !== userId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await axios.patch(`${API_URL}/api/admin/users/${userId}/role`,
        { role: newRole },
        { withCredentials: true }
      );
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role) => role === 'admin'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-blue-100 text-blue-700';

  const tierColor = (tier) => {
    if (tier === 'enterprise') return 'bg-purple-100 text-purple-700';
    if (tier === 'pro') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  };

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
              <p className="text-xs text-orange-600 font-bold uppercase tracking-widest">Admin Panel</p>
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
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Users', value: stats.total_users, icon: <Users size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Total Predictions', value: stats.total_predictions, icon: <ChartBar size={20} />, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Total Optimizations', value: stats.total_optimizations, icon: <ChartBar size={20} />, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Admin Users', value: stats.admin_count, icon: <ShieldCheck size={20} />, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center ${color} mb-3`}>
                  {icon}
                </div>
                <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex border-b border-gray-200 px-6">
            {[
              { id: 'users', label: 'Users', icon: <Users size={16} /> },
              { id: 'activity', label: 'Activity', icon: <ChartBar size={16} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'users' && (
            <div className="p-6">
              {/* Search */}
              <div className="relative mb-6">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email or company..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="pb-3 pr-4">User</th>
                        <th className="pb-3 pr-4">Company</th>
                        <th className="pb-3 pr-4">Role</th>
                        <th className="pb-3 pr-4">Tier</th>
                        <th className="pb-3 pr-4">Joined</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0">
                                {u.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{u.name}</p>
                                <p className="text-xs text-gray-500">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{u.company || '—'}</td>
                          <td className="py-3 pr-4">
                            <select
                              value={u.role}
                              onChange={e => handleChangeRole(u.id, e.target.value)}
                              className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${roleColor(u.role)}`}
                              disabled={u.id === user?.id}
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${tierColor(u.subscription_tier)}`}>
                              {u.subscription_tier || 'free'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-500 text-xs">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3">
                            {u.id !== user?.id ? (
                              deleteConfirm === u.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-red-600">Sure?</span>
                                  <button onClick={() => handleDeleteUser(u.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded">Yes</button>
                                  <button onClick={() => setDeleteConfirm(null)} className="text-xs bg-gray-200 px-2 py-1 rounded">No</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(u.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                >
                                  <Trash size={16} />
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-gray-400 italic">you</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div className="text-center py-8 text-gray-400">No users found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="p-6">
              {stats ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 mb-4">Platform Activity Summary</h3>
                  {[
                    { label: 'Total strength predictions made', value: stats.total_predictions },
                    { label: 'Total mix optimizations run', value: stats.total_optimizations },
                    { label: 'Registered users', value: stats.total_users },
                    { label: 'Admin accounts', value: stats.admin_count },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className="text-lg font-bold text-gray-900">{value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">Loading activity...</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => handleDeleteUser(deleteConfirm)}>Delete</Button>
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};