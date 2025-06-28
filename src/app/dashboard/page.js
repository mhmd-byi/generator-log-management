'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import GeneratorCard from '../../components/GeneratorCard';

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [gensets, setGensets] = useState([]);
  const [venues, setVenues] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('generators');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'venue', 'generator', 'user'
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form states
  const [venueForm, setVenueForm] = useState({
    name: '',
    location: '',
    description: '',
    contactPerson: { name: '', phone: '', email: '' }
  });
  
  const [generatorForm, setGeneratorForm] = useState({
    name: '',
    model: '',
    serialNumber: '',
    capacity: '',
    capacityUnit: 'KW',
    fuelType: 'Diesel',
    venueId: ''
  });
  
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    assignedVenue: ''
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, loading, router]);

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);
      setError('');

      // Load generators
      const gensetsResponse = await fetch('/api/user/gensets');
      if (gensetsResponse.ok) {
        const gensetsData = await gensetsResponse.json();
        setGensets(gensetsData.gensets || []);
      }

      // Load admin data if user is admin
      if (user?.role === 'admin') {
        const [venuesResponse, usersResponse, logsResponse] = await Promise.all([
          fetch('/api/admin/venues'),
          fetch('/api/admin/users'),
          fetch('/api/logs?limit=100')
        ]);

        if (venuesResponse.ok) {
          const venuesData = await venuesResponse.json();
          setVenues(venuesData.venues || []);
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.users || []);
        }

        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          setLogs(logsData.logs || []);
        }
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleToggleGenset = async (gensetId) => {
    try {
      const response = await fetch(`/api/gensets/${gensetId}/toggle`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setGensets(prev => 
          prev.map(g => 
            g._id === gensetId 
              ? { ...g, status: data.newStatus, lastStatusChange: new Date(), lastStatusChangedBy: user }
              : g
          )
        );
        
        // Refresh logs for admin users to show the new activity
        if (user?.role === 'admin') {
          const logsResponse = await fetch('/api/logs?limit=100');
          if (logsResponse.ok) {
            const logsData = await logsResponse.json();
            setLogs(logsData.logs || []);
          }
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to toggle generator');
      }
    } catch (error) {
      console.error('Toggle error:', error);
      setError('Failed to toggle generator');
    }
  };

  const openAddModal = (type) => {
    setModalType(type);
    setShowAddModal(true);
    setError('');
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setEditingItem(item);
    setShowEditModal(true);
    setError('');
    
    // Pre-populate forms with existing data
    if (type === 'venue') {
      setVenueForm({
        name: item.name || '',
        location: item.location || '',
        description: item.description || '',
        contactPerson: item.contactPerson || { name: '', phone: '', email: '' }
      });
    } else if (type === 'generator') {
      setGeneratorForm({
        name: item.name || '',
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        capacity: item.capacity || '',
        capacityUnit: item.capacityUnit || 'KW',
        fuelType: item.fuelType || 'Diesel',
        venueId: item.venue?._id || ''
      });
    } else if (type === 'user') {
      setUserForm({
        username: item.username || '',
        email: item.email || '',
        password: '', // Don't pre-fill password for security
        role: item.role || 'user',
        assignedVenue: item.assignedVenue?._id || ''
      });
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setModalType('');
    setEditingItem(null);
    // Reset forms
    setVenueForm({ name: '', location: '', description: '', contactPerson: { name: '', phone: '', email: '' } });
    setGeneratorForm({ name: '', model: '', serialNumber: '', capacity: '', capacityUnit: 'KW', fuelType: 'Diesel', venueId: '' });
    setUserForm({ username: '', email: '', password: '', role: 'user', assignedVenue: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let endpoint = '';
      let payload = {};
      let method = showEditModal ? 'PATCH' : 'POST';

      switch (modalType) {
        case 'venue':
          endpoint = '/api/admin/venues';
          payload = showEditModal 
            ? { venueId: editingItem._id, ...venueForm }
            : venueForm;
          break;
        case 'generator':
          endpoint = '/api/admin/gensets';
          payload = showEditModal 
            ? { gensetId: editingItem._id, ...generatorForm }
            : generatorForm;
          break;
        case 'user':
          endpoint = '/api/admin/users';
          payload = showEditModal 
            ? { userId: editingItem._id, ...userForm }
            : userForm;
          break;
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - refresh data and close modal
        await loadDashboardData();
        closeModal();
      } else {
        setError(data.error || 'Failed to save item');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const tabs = user?.role === 'admin' 
    ? [
        { id: 'generators', name: 'Generators', count: gensets.length },
        { id: 'venues', name: 'Venues', count: venues.length },
        { id: 'users', name: 'Users', count: users.length },
        { id: 'logs', name: 'Activity Logs', count: logs.length }
      ]
    : [
        { id: 'generators', name: 'Generators', count: gensets.length }
      ];

  const modalTitle = showEditModal 
    ? `Edit ${modalType === 'generator' ? 'Generator' : modalType === 'venue' ? 'Venue' : 'User'}`
    : `Add ${modalType === 'generator' ? 'Generator' : modalType === 'venue' ? 'Venue' : 'User'}`;

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Dashboard
            </h2>
            {user?.assignedVenue && (
              <p className="mt-1 text-sm text-gray-500">
                Managing: {user.assignedVenue.name}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.name}
                  {tab.count > 0 && (
                    <span className={`${
                      activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-900'
                    } hidden ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {loadingData ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading data...</p>
            </div>
          ) : (
            <>
              {/* Generators Tab */}
              {activeTab === 'generators' && (
                <div className="space-y-4">
                  {user?.role === 'admin' && (
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Generators</h3>
                      <button
                        onClick={() => openAddModal('generator')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Generator
                      </button>
                    </div>
                  )}
                  
                  {gensets.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No generators found</p>
                      {user?.role !== 'admin' && !user?.assignedVenue && (
                        <p className="text-sm text-gray-400 mt-2">
                          Please contact admin to assign you to a venue
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {gensets.map((genset) => (
                        <div key={genset._id} className="relative">
                          <GeneratorCard
                            genset={genset}
                            onToggle={handleToggleGenset}
                            canToggle={true}
                          />
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => openEditModal('generator', genset)}
                              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-800"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Venues Tab */}
              {activeTab === 'venues' && user?.role === 'admin' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Venues</h3>
                    <button
                      onClick={() => openAddModal('venue')}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Venue
                    </button>
                  </div>
                  
                  {venues.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No venues found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {venues.map((venue) => (
                        <div key={venue._id} className="relative bg-white overflow-hidden shadow rounded-lg">
                          <div className="p-6">
                            <h3 className="text-lg font-medium text-gray-900">{venue.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{venue.location}</p>
                            {venue.description && (
                              <p className="text-sm text-gray-600 mt-2">{venue.description}</p>
                            )}
                            {venue.contactPerson?.name && (
                              <div className="mt-3 text-sm text-gray-600">
                                <p><strong>Contact:</strong> {venue.contactPerson.name}</p>
                                {venue.contactPerson.phone && <p>Phone: {venue.contactPerson.phone}</p>}
                                {venue.contactPerson.email && <p>Email: {venue.contactPerson.email}</p>}
                              </div>
                            )}
                            <div className="mt-4 text-xs text-gray-500">
                              Created: {new Date(venue.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => openEditModal('venue', venue)}
                            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-800"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && user?.role === 'admin' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Users</h3>
                    <button
                      onClick={() => openAddModal('user')}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add User
                    </button>
                  </div>
                  
                  {users.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No users found</p>
                    </div>
                  ) : (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <ul className="divide-y divide-gray-200">
                        {users.map((userData) => (
                          <li key={userData._id} className="px-6 py-4 relative">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {userData.username}
                                  </p>
                                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    userData.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {userData.role}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 truncate">{userData.email}</p>
                                {userData.assignedVenue && (
                                  <p className="text-sm text-gray-500">
                                    Venue: {userData.assignedVenue.name}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => openEditModal('user', userData)}
                                className="ml-4 p-1 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-800"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Logs Tab */}
              {activeTab === 'logs' && user?.role === 'admin' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Activity Logs</h3>
                    <div className="text-sm text-gray-500">
                      Showing recent generator activities across all venues
                    </div>
                  </div>
                  
                  {logs.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No activity logs found</p>
                    </div>
                  ) : (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Timestamp
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Generator
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Venue
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Action
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status Change
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log) => (
                              <tr key={log._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <div>
                                    {new Date(log.timestamp).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {log.genset?.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {log.genset?.model} • {log.genset?.serialNumber}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{log.venue?.name}</div>
                                  <div className="text-sm text-gray-500">{log.venue?.location}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    log.action === 'TURN_ON' ? 'bg-green-100 text-green-800' :
                                    log.action === 'TURN_OFF' ? 'bg-red-100 text-red-800' :
                                    log.action === 'CREATED' ? 'bg-blue-100 text-blue-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {log.action.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {log.previousStatus && log.newStatus ? (
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        log.previousStatus === 'ON' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {log.previousStatus}
                                      </span>
                                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                      </svg>
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        log.newStatus === 'ON' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {log.newStatus}
                                      </span>
                                    </div>
                                  ) : log.newStatus ? (
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      log.newStatus === 'ON' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {log.newStatus}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{log.user?.username}</div>
                                  <div className="text-sm text-gray-500">{log.user?.email}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {modalTitle}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-3">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Venue Form */}
                {modalType === 'venue' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name *</label>
                      <input
                        type="text"
                        required
                        value={venueForm.name}
                        onChange={(e) => setVenueForm({...venueForm, name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location *</label>
                      <input
                        type="text"
                        required
                        value={venueForm.location}
                        onChange={(e) => setVenueForm({...venueForm, location: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        value={venueForm.description}
                        onChange={(e) => setVenueForm({...venueForm, description: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Contact Person (Optional)</h4>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Name"
                          value={venueForm.contactPerson.name}
                          onChange={(e) => setVenueForm({...venueForm, contactPerson: {...venueForm.contactPerson, name: e.target.value}})}
                          className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="tel"
                          placeholder="Phone"
                          value={venueForm.contactPerson.phone}
                          onChange={(e) => setVenueForm({...venueForm, contactPerson: {...venueForm.contactPerson, phone: e.target.value}})}
                          className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={venueForm.contactPerson.email}
                          onChange={(e) => setVenueForm({...venueForm, contactPerson: {...venueForm.contactPerson, email: e.target.value}})}
                          className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Generator Form */}
                {modalType === 'generator' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name *</label>
                      <input
                        type="text"
                        required
                        value={generatorForm.name}
                        onChange={(e) => setGeneratorForm({...generatorForm, name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Model *</label>
                      <input
                        type="text"
                        required
                        value={generatorForm.model}
                        onChange={(e) => setGeneratorForm({...generatorForm, model: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Serial Number *</label>
                      <input
                        type="text"
                        required
                        value={generatorForm.serialNumber}
                        onChange={(e) => setGeneratorForm({...generatorForm, serialNumber: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Capacity *</label>
                        <input
                          type="number"
                          required
                          value={generatorForm.capacity}
                          onChange={(e) => setGeneratorForm({...generatorForm, capacity: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Unit</label>
                        <select
                          value={generatorForm.capacityUnit}
                          onChange={(e) => setGeneratorForm({...generatorForm, capacityUnit: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="KW">KW</option>
                          <option value="MW">MW</option>
                          <option value="HP">HP</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                      <select
                        value={generatorForm.fuelType}
                        onChange={(e) => setGeneratorForm({...generatorForm, fuelType: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Diesel">Diesel</option>
                        <option value="Natural Gas">Natural Gas</option>
                        <option value="Gasoline">Gasoline</option>
                        <option value="Propane">Propane</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Venue *</label>
                      <select
                        required
                        value={generatorForm.venueId}
                        onChange={(e) => setGeneratorForm({...generatorForm, venueId: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Venue</option>
                        {venues.map((venue) => (
                          <option key={venue._id} value={venue._id}>{venue.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* User Form */}
                {modalType === 'user' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username *</label>
                      <input
                        type="text"
                        required
                        value={userForm.username}
                        onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email *</label>
                      <input
                        type="email"
                        required
                        value={userForm.email}
                        onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {!showEditModal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Password *</label>
                        <input
                          type="password"
                          required={!showEditModal}
                          value={userForm.password}
                          onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Assigned Venue</label>
                      <select
                        value={userForm.assignedVenue}
                        onChange={(e) => setUserForm({...userForm, assignedVenue: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">No Venue Assignment</option>
                        {venues.map((venue) => (
                          <option key={venue._id} value={venue._id}>{venue.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (showEditModal ? 'Updating...' : 'Creating...') : (showEditModal ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
} 