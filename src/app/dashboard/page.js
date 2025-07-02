'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import GeneratorCard from '../../components/GeneratorCard';
import StatsDashboard from '../../components/dashboard/StatsDashboard';
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [gensets, setGensets] = useState([]);
  const [venues, setVenues] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('statistics');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [logFilters, setLogFilters] = useState({
    venue: 'all',
    genset: 'all',
    user: 'all',
    action: 'all'
  });
  const [filterOptions, setFilterOptions] = useState({
    venues: [],
    gensets: [],
    users: [],
    actions: []
  });
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [showDeleteLogModal, setShowDeleteLogModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'venue', 'generator', 'user'
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [deletingLog, setDeletingLog] = useState(null);
  
  // Bulk upload states
  const [uploadFile, setUploadFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // 'parsing', 'uploading', 'complete', 'error'
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploadResults, setUploadResults] = useState({ success: 0, failed: 0 });
  const [bulkUploadType, setBulkUploadType] = useState(''); // 'generator' or 'user'
  
  // Form states
  const [venueForm, setVenueForm] = useState({
    name: '',
    description: '',
    contactPerson: { name: '', phone: '', email: '' }
  });
  
  const [generatorForm, setGeneratorForm] = useState([{
    name: '',
    capacity: '',
    capacityUnit: 'KW',
    venueId: ''
  }]);
  
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    assignedVenue: ''
  });

  // Manual log form state
  const [manualLogForm, setManualLogForm] = useState({
    gensetId: '',
    action: 'MANUAL',
    notes: '',
    customTimestamp: ''
  });

  // Edit log form state
  const [editLogForm, setEditLogForm] = useState({
    gensetId: '',
    action: 'MANUAL',
    notes: '',
    customTimestamp: ''
  });

  // Generator form management functions
  const addGeneratorForm = () => {
    setGeneratorForm(prev => [...prev, {
      name: '',
      capacity: '',
      capacityUnit: 'KW',
      venueId: ''
    }]);
  };

  const removeGeneratorForm = (index) => {
    if (generatorForm.length > 1) {
      setGeneratorForm(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateGeneratorForm = (index, field, value) => {
    setGeneratorForm(prev => prev.map((form, i) => 
      i === index ? { ...form, [field]: value } : form
    ));
  };

  // Bulk upload functions
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadFile(file);
    setUploadStatus('parsing');
    setUploadErrors([]);
    setParsedData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate and transform data based on type
        const validatedData = [];
        const errors = [];

        if (bulkUploadType === 'generator') {
          jsonData.forEach((row, index) => {
            const rowNumber = index + 2; // Excel row number (accounting for header)
            const errors_in_row = [];

            // Validate required fields for generators
            if (!row.Name || typeof row.Name !== 'string' || row.Name.trim() === '') {
              errors_in_row.push('Name is required');
            }
            if (!row.Capacity || isNaN(Number(row.Capacity))) {
              errors_in_row.push('Capacity must be a valid number');
            }
            if (!row.Venue || typeof row.Venue !== 'string' || row.Venue.trim() === '') {
              errors_in_row.push('Venue is required');
            }

            // Find venue by name
            const venue = venues.find(v => v.name.toLowerCase().trim() === String(row.Venue).toLowerCase().trim());
            if (row.Venue && !venue) {
              errors_in_row.push(`Venue "${row.Venue}" not found`);
            }

            if (errors_in_row.length > 0) {
              errors.push({
                row: rowNumber,
                errors: errors_in_row,
                data: row
              });
            } else {
              validatedData.push({
                name: String(row.Name).trim(),
                capacity: Number(row.Capacity),
                capacityUnit: row.Unit && ['KW', 'MW', 'HP'].includes(String(row.Unit).toUpperCase()) 
                  ? String(row.Unit).toUpperCase() 
                  : 'KW',
                venueId: venue._id,
                venueName: venue.name
              });
            }
          });
        } else if (bulkUploadType === 'user') {
          jsonData.forEach((row, index) => {
            const rowNumber = index + 2; // Excel row number (accounting for header)
            const errors_in_row = [];

            // Validate required fields for users
            if (!row.Username || typeof row.Username !== 'string' || row.Username.trim() === '') {
              errors_in_row.push('Username is required');
            }
            if (!row.Email || typeof row.Email !== 'string' || row.Email.trim() === '') {
              errors_in_row.push('Email is required');
            } else {
              // Basic email validation
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(row.Email.trim())) {
                errors_in_row.push('Invalid email format');
              }
            }
            if (!row.Password || typeof row.Password !== 'string' || row.Password.trim() === '') {
              errors_in_row.push('Password is required');
            }

            // Validate role
            const role = row.Role ? String(row.Role).toLowerCase().trim() : 'user';
            if (!['user', 'admin'].includes(role)) {
              errors_in_row.push('Role must be "user" or "admin"');
            }

            // Find venue by name (optional for users)
            let venue = null;
            if (row.Venue && typeof row.Venue === 'string' && row.Venue.trim() !== '') {
              venue = venues.find(v => v.name.toLowerCase().trim() === String(row.Venue).toLowerCase().trim());
              if (!venue) {
                errors_in_row.push(`Venue "${row.Venue}" not found`);
              }
            }

            if (errors_in_row.length > 0) {
              errors.push({
                row: rowNumber,
                errors: errors_in_row,
                data: row
              });
            } else {
              validatedData.push({
                username: String(row.Username).trim(),
                email: String(row.Email).trim(),
                password: String(row.Password).trim(),
                role: role,
                assignedVenue: venue ? venue._id : '',
                venueName: venue ? venue.name : 'No venue assigned'
              });
            }
          });
        }

        setParsedData(validatedData);
        setUploadErrors(errors);
        setUploadStatus(errors.length > 0 ? 'error' : 'ready');
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        setUploadStatus('error');
        setUploadErrors([{ row: 0, errors: ['Invalid Excel file format'], data: {} }]);
      }
    };

    reader.readAsBinaryString(file);
  };

  const processBulkUpload = async () => {
    if (parsedData.length === 0) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Determine endpoint based on upload type
    const endpoint = bulkUploadType === 'generator' ? '/api/admin/gensets' : '/api/admin/users';

    for (let i = 0; i < parsedData.length; i++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parsedData[i]),
        });

        const data = await response.json();

        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
          errors.push(`Row ${i + 1}: ${data.error || 'Failed to save'}`);
        }
      } catch (error) {
        failedCount++;
        errors.push(`Row ${i + 1}: Network error`);
      }

      // Update progress
      setUploadProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    setUploadResults({ success: successCount, failed: failedCount });
    setUploadErrors(errors.map((error, index) => ({ row: index + 1, errors: [error], data: {} })));
    setUploadStatus('complete');

    // Refresh data if any succeeded
    if (successCount > 0) {
      await loadDashboardData();
    }
  };

  const resetBulkUpload = () => {
    setUploadFile(null);
    setParsedData([]);
    setUploadProgress(0);
    setUploadStatus('');
    setUploadErrors([]);
    setUploadResults({ success: 0, failed: 0 });
  };

  const closeBulkUploadModal = () => {
    setShowBulkUploadModal(false);
    resetBulkUpload();
  };

  const downloadTemplate = () => {
    let templateData = [];
    let filename = '';
    let sheetName = '';

    if (bulkUploadType === 'generator') {
      templateData = [
        {
          Name: 'Generator 1',
          Capacity: 100,
          Unit: 'KW',
          Venue: 'Main Office'
        },
        {
          Name: 'Generator 2',
          Capacity: 250,
          Unit: 'KW',
          Venue: 'Warehouse'
        }
      ];
      filename = 'generator_template.xlsx';
      sheetName = 'Generators';
    } else if (bulkUploadType === 'user') {
      templateData = [
        {
          Username: 'john.doe',
          Email: 'john.doe@example.com',
          Password: 'password123',
          Role: 'user',
          Venue: 'Main Office'
        },
        {
          Username: 'jane.admin',
          Email: 'jane.admin@example.com',
          Password: 'securepass456',
          Role: 'admin',
          Venue: ''
        }
      ];
      filename = 'user_template.xlsx';
      sheetName = 'Users';
    }

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
  };

  const openBulkUploadModal = (type) => {
    setBulkUploadType(type);
    setShowBulkUploadModal(true);
    resetBulkUpload();
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, loading, router]);

  // Reload logs when filters change
  useEffect(() => {
    if (user?.role === 'admin' && filterOptions.venues.length > 0) {
      loadLogs();
    }
  }, [logFilters]);

  const loadLogs = async () => {
    try {
      // Build query parameters based on filters
      const params = new URLSearchParams();
      Object.entries(logFilters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/logs?limit=100&${params.toString()}`);
      if (response.ok) {
        const logsData = await response.json();
        setLogs(logsData.logs || []);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      setError('Failed to load activity logs');
    }
  };

  const loadFilterOptions = async () => {
    try {
      setLoadingFilters(true);
      const response = await fetch('/api/logs/filters');
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

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
        const [venuesResponse, usersResponse] = await Promise.all([
          fetch('/api/admin/venues'),
          fetch('/api/admin/users')
        ]);

        if (venuesResponse.ok) {
          const venuesData = await venuesResponse.json();
          setVenues(venuesData.venues || []);
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.users || []);
        }

        // Load logs and filter options separately
        await Promise.all([
          loadLogs(),
          loadFilterOptions()
        ]);
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
          loadLogs();
        }
      } else {
        const errorData = await response.json();
        // Throw error for GeneratorCard to handle
        const error = new Error(errorData.error || 'Failed to toggle generator');
        error.response = { data: errorData };
        throw error;
      }
    } catch (error) {
      console.error('Toggle error:', error);
      // Re-throw the error so GeneratorCard can handle it
      throw error;
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
        description: item.description || '',
        contactPerson: item.contactPerson || { name: '', phone: '', email: '' }
      });
    } else if (type === 'generator') {
      setGeneratorForm([{
        name: item.name || '',
        capacity: item.capacity || '',
        capacityUnit: item.capacityUnit || 'KW',
        venueId: item.venue?._id || ''
      }]);
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

  const openDeleteModal = (type, item) => {
    setModalType(type);
    setDeletingItem(item);
    setShowDeleteModal(true);
    setError('');
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    
    setSubmitting(true);
    setError('');

    try {
      let endpoint = '';
      let payload = {};

      switch (modalType) {
        case 'venue':
          endpoint = '/api/admin/venues';
          payload = { venueId: deletingItem._id };
          break;
        case 'generator':
          endpoint = '/api/admin/gensets';
          payload = { gensetId: deletingItem._id };
          break;
        case 'user':
          endpoint = '/api/admin/users';
          payload = { userId: deletingItem._id };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
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
        setError(data.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete item');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowManualLogModal(false);
    setShowEditLogModal(false);
    setShowDeleteLogModal(false);
    setModalType('');
    setEditingItem(null);
    setDeletingItem(null);
    setEditingLog(null);
    setDeletingLog(null);
    setError('');
    // Reset forms
    setVenueForm({ name: '', description: '', contactPerson: { name: '', phone: '', email: '' } });
    setGeneratorForm([{ name: '', capacity: '', capacityUnit: 'KW', venueId: '' }]);
    setUserForm({ username: '', email: '', password: '', role: 'user', assignedVenue: '' });
    setManualLogForm({ gensetId: '', action: 'MANUAL', notes: '', customTimestamp: '' });
    setEditLogForm({ gensetId: '', action: 'MANUAL', notes: '', customTimestamp: '' });
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
          if (showEditModal) {
            payload = { gensetId: editingItem._id, ...generatorForm[0] };
          } else {
            // For adding new generators, we'll handle multiple generators
            payload = generatorForm[0]; // Start with the first one
          }
          break;
        case 'user':
          endpoint = '/api/admin/users';
          payload = showEditModal 
            ? { userId: editingItem._id, ...userForm }
            : userForm;
          break;
      }

      // Handle multiple generators for adding new ones
      if (modalType === 'generator' && !showEditModal && generatorForm.length > 1) {
        let successCount = 0;
        let errorMessages = [];

        for (const [index, generator] of generatorForm.entries()) {
          try {
            const response = await fetch(endpoint, {
              method,
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(generator),
            });

            const data = await response.json();

            if (response.ok) {
              successCount++;
            } else {
              errorMessages.push(`Generator ${index + 1}: ${data.error || 'Failed to save'}`);
            }
          } catch (error) {
            errorMessages.push(`Generator ${index + 1}: Network error`);
          }
        }

        if (errorMessages.length > 0) {
          setError(`${successCount} generator(s) saved successfully. Errors: ${errorMessages.join(', ')}`);
        } else {
          // All successful - refresh data and close modal
          await loadDashboardData();
          closeModal();
        }
      } else {
        // Handle single item (edit mode or single generator)
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
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter management functions
  const handleFilterChange = (filterType, value) => {
    setLogFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearAllFilters = () => {
    setLogFilters({
      venue: 'all',
      genset: 'all',
      user: 'all',
      action: 'all'
    });
  };

  const hasActiveFilters = () => {
    return Object.values(logFilters).some(value => value !== 'all');
  };

  // Manual log functions
  const openManualLogModal = () => {
    setShowManualLogModal(true);
    setManualLogForm({
      gensetId: '',
      action: 'MANUAL',
      notes: '',
      customTimestamp: ''
    });
  };

  const handleManualLogSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { gensetId, action, notes, customTimestamp } = manualLogForm;

      if (!gensetId || !notes.trim()) {
        setError('Please select a generator and enter notes.');
        return;
      }

      const payload = {
        gensetId,
        action,
        notes: notes.trim()
      };

      // Add custom timestamp if provided
      if (customTimestamp) {
        payload.customTimestamp = customTimestamp;
      }

      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadLogs(); // Refresh logs
        closeModal();
        setError(''); // Clear any previous errors
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create log entry');
      }
    } catch (error) {
      console.error('Manual log submit error:', error);
      setError('Failed to create log entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Log editing functions
  const openEditLogModal = (log) => {
    setEditingLog(log);
    setEditLogForm({
      gensetId: log.genset._id,
      action: log.action,
      notes: log.notes || '',
      customTimestamp: log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 16) : ''
    });
    setShowEditLogModal(true);
  };

  const openDeleteLogModal = (log) => {
    setDeletingLog(log);
    setShowDeleteLogModal(true);
  };

  const handleEditLogSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { gensetId, action, notes, customTimestamp } = editLogForm;

      if (!gensetId || !notes.trim()) {
        setError('Please select a generator and enter notes.');
        return;
      }

      const payload = {
        gensetId,
        action,
        notes: notes.trim()
      };

      // Add custom timestamp if provided
      if (customTimestamp) {
        payload.customTimestamp = customTimestamp;
      }

      const response = await fetch(`/api/logs/${editingLog._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadLogs(); // Refresh logs
        setShowEditLogModal(false);
        setEditingLog(null);
        setError(''); // Clear any previous errors
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update log entry');
      }
    } catch (error) {
      console.error('Edit log submit error:', error);
      setError('Failed to update log entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async () => {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/logs/${deletingLog._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await loadLogs(); // Refresh logs
        setShowDeleteLogModal(false);
        setDeletingLog(null);
        setError(''); // Clear any previous errors
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete log entry');
      }
    } catch (error) {
      console.error('Delete log error:', error);
      setError('Failed to delete log entry. Please try again.');
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
        { id: 'statistics', name: 'Statistics', count: null },
        { id: 'generators', name: 'Generators', count: gensets.length },
        { id: 'venues', name: 'Venues', count: venues.length },
        { id: 'users', name: 'Users', count: users.length },
        { id: 'logs', name: 'Activity Logs', count: logs.length }
      ]
    : [
        { id: 'statistics', name: 'Statistics', count: null },
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
                  {tab.count !== null && tab.count > 0 && (
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
              {/* Statistics Tab */}
              {activeTab === 'statistics' && (
                <div className="space-y-4">
                  <StatsDashboard user={user} />
                </div>
              )}

              {/* Generators Tab */}
              {activeTab === 'generators' && (
                <div className="space-y-4">
                  {user?.role === 'admin' && (
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Generators</h3>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => openBulkUploadModal('generator')}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Bulk Upload
                        </button>
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
                            <div className="absolute top-2 right-2 flex space-x-1">
                              <button
                                onClick={() => openEditModal('generator', genset)}
                                className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-800"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal('generator', genset)}
                                className="p-1 bg-white rounded-full shadow-md hover:bg-red-50 text-gray-600 hover:text-red-800"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
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
                          <div className="absolute top-2 right-2 flex space-x-1">
                            <button
                              onClick={() => openEditModal('venue', venue)}
                              className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-800"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openDeleteModal('venue', venue)}
                              className="p-1 bg-white rounded-full shadow-md hover:bg-red-50 text-gray-600 hover:text-red-800"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
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
                    <div className="flex space-x-3">
                      <button
                        onClick={() => openBulkUploadModal('user')}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        Bulk Upload
                      </button>
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
                              <div className="ml-4 flex space-x-1">
                                <button
                                  onClick={() => openEditModal('user', userData)}
                                  className="p-1 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-800"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal('user', userData)}
                                  className="p-1 bg-gray-50 rounded-full hover:bg-red-100 text-gray-600 hover:text-red-800"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
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
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={openManualLogModal}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Manual Log
                      </button>
                      <div className="text-sm text-gray-500">
                        Showing recent generator activities across all venues
                      </div>
                    </div>
                  </div>
                  
                  {/* Filter Controls */}
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Venue Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                          <select
                            value={logFilters.venue}
                            onChange={(e) => handleFilterChange('venue', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loadingFilters}
                          >
                            <option value="all">All Venues</option>
                            {filterOptions.venues.map((venue) => (
                              <option key={venue._id} value={venue._id}>{venue.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Generator Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Generator</label>
                          <select
                            value={logFilters.genset}
                            onChange={(e) => handleFilterChange('genset', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loadingFilters}
                          >
                            <option value="all">All Generators</option>
                            {filterOptions.gensets.map((genset) => (
                              <option key={genset._id} value={genset._id}>
                                {genset.name} ({genset.venueName})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* User Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                          <select
                            value={logFilters.user}
                            onChange={(e) => handleFilterChange('user', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loadingFilters}
                          >
                            <option value="all">All Users</option>
                            {filterOptions.users.map((user) => (
                              <option key={user._id} value={user._id}>{user.username}</option>
                            ))}
                          </select>
                        </div>

                        {/* Action Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                          <select
                            value={logFilters.action}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loadingFilters}
                          >
                            <option value="all">All Actions</option>
                            {filterOptions.actions.map((action) => (
                              <option key={action} value={action}>{action.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* Clear Filters Button */}
                      {hasActiveFilters() && (
                        <div className="flex items-end">
                          <button
                            onClick={clearAllFilters}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          >
                            Clear Filters
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Active Filters Display */}
                    {hasActiveFilters() && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <span>Active filters:</span>
                        {Object.entries(logFilters).map(([key, value]) => {
                          if (value === 'all') return null;
                          let displayValue = value;
                          
                          // Get display names for filter values
                          if (key === 'venue') {
                            const venue = filterOptions.venues.find(v => v._id === value);
                            displayValue = venue ? venue.name : value;
                          } else if (key === 'genset') {
                            const genset = filterOptions.gensets.find(g => g._id === value);
                            displayValue = genset ? genset.name : value;
                          } else if (key === 'user') {
                            const user = filterOptions.users.find(u => u._id === value);
                            displayValue = user ? user.username : value;
                          } else if (key === 'action') {
                            displayValue = value.replace('_', ' ');
                          }
                          
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {key}: {displayValue}
                              <button
                                onClick={() => handleFilterChange(key, 'all')}
                                className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-blue-600 hover:text-blue-800"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {logs.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        {hasActiveFilters() ? 'No activity logs match the selected filters' : 'No activity logs found'}
                      </p>
                      {hasActiveFilters() && (
                        <button
                          onClick={clearAllFilters}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          Clear filters to see all logs
                        </button>
                      )}
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
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Notes
                              </th>
                              {user?.role === 'admin' && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Actions
                                </th>
                              )}
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
                                    {log.genset?.model}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{log.venue?.name}</div>
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
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                  {log.notes ? (
                                    <div className="truncate" title={log.notes}>
                                      {log.notes}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                {user?.role === 'admin' && (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => openEditLogModal(log)}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="Edit log"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => openDeleteLogModal(log)}
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete log"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                )}
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
                  <div className="space-y-6">
                    {generatorForm.map((generator, index) => (
                      <div key={index} className={`${index > 0 ? 'border-t pt-6' : ''}`}>
                        {generatorForm.length > 1 && (
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-900">Generator {index + 1}</h4>
                            {generatorForm.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeGeneratorForm(index)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Name *</label>
                            <input
                              type="text"
                              required
                              value={generator.name}
                              onChange={(e) => updateGeneratorForm(index, 'name', e.target.value)}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Capacity *</label>
                              <input
                                type="number"
                                required
                                value={generator.capacity}
                                onChange={(e) => updateGeneratorForm(index, 'capacity', e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Unit</label>
                              <select
                                value={generator.capacityUnit}
                                onChange={(e) => updateGeneratorForm(index, 'capacityUnit', e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="KW">KW</option>
                                <option value="MW">MW</option>
                                <option value="HP">HP</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Venue *</label>
                            <select
                              required
                              value={generator.venueId}
                              onChange={(e) => updateGeneratorForm(index, 'venueId', e.target.value)}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select Venue</option>
                              {venues.map((venue) => (
                                <option key={venue._id} value={venue._id}>{venue.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {!showEditModal && (
                      <div className="border-t pt-4">
                        <button
                          type="button"
                          onClick={addGeneratorForm}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add Another Generator
                        </button>
                        {generatorForm.length > 1 && (
                          <p className="mt-2 text-sm text-gray-500">
                            Adding {generatorForm.length} generators. Each will be saved individually.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Confirm Delete
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

              <div className="text-sm text-gray-600 mb-6">
                <p className="mb-2">
                  Are you sure you want to delete this {modalType === 'generator' ? 'generator' : modalType}?
                </p>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="font-medium text-gray-900">
                    {modalType === 'generator' && deletingItem.name}
                    {modalType === 'venue' && deletingItem.name}
                    {modalType === 'user' && deletingItem.username}
                  </p>
                  {modalType === 'generator' && deletingItem.model && (
                    <p className="text-sm text-gray-600">
                      {deletingItem.model}
                    </p>
                  )}
                  {modalType === 'venue' && deletingItem.description && (
                    <p className="text-sm text-gray-600">
                      {deletingItem.description}
                    </p>
                  )}
                  {modalType === 'user' && (
                    <p className="text-sm text-gray-600">
                      {deletingItem.email}
                    </p>
                  )}
                </div>
                <p className="mt-3 text-red-600 font-medium">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Bulk Upload {bulkUploadType === 'generator' ? 'Generators' : 'Users'}
                </h3>
                <button
                  onClick={closeBulkUploadModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step 1: File Upload */}
              {!uploadFile && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p className="mb-4">
                      Upload an Excel file with {bulkUploadType} data. The file should have the following columns:
                    </p>
                    <div className="bg-gray-50 p-4 rounded-md">
                      {bulkUploadType === 'generator' ? (
                        <ul className="list-disc list-inside space-y-1">
                          <li><strong>Name</strong> - Generator name (required)</li>
                          <li><strong>Capacity</strong> - Capacity in numbers (required)</li>
                          <li><strong>Unit</strong> - KW, MW, or HP (optional, defaults to KW)</li>
                          <li><strong>Venue</strong> - Venue name (required, must match existing venue)</li>
                        </ul>
                      ) : (
                        <ul className="list-disc list-inside space-y-1">
                          <li><strong>Username</strong> - Unique username (required)</li>
                          <li><strong>Email</strong> - Valid email address (required)</li>
                          <li><strong>Password</strong> - User password (required)</li>
                          <li><strong>Role</strong> - &quot;user&quot; or &quot;admin&quot; (optional, defaults to &quot;user&quot;)</li>
                          <li><strong>Venue</strong> - Venue name (optional, must match existing venue if provided)</li>
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={downloadTemplate}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      Download Template
                    </button>

                    <div>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="bulk-upload-file"
                      />
                      <label
                        htmlFor="bulk-upload-file"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Choose Excel File
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Processing/Preview */}
              {uploadFile && uploadStatus === 'parsing' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Parsing Excel file...</p>
                </div>
              )}

              {/* Step 3: Validation Results */}
              {uploadFile && (uploadStatus === 'ready' || uploadStatus === 'error') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">
                      Validation Results
                    </h4>
                    <button
                      onClick={resetBulkUpload}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Choose Different File
                    </button>
                  </div>

                  {parsedData.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-md">
                      <h5 className="text-sm font-medium text-green-800 mb-2">
                        Valid {bulkUploadType === 'generator' ? 'Generators' : 'Users'} ({parsedData.length})
                      </h5>
                      <div className="max-h-40 overflow-y-auto">
                        <div className="space-y-1">
                          {parsedData.map((item, index) => (
                            <div key={index} className="text-sm text-green-700">
                              {bulkUploadType === 'generator' ? (
                                `${item.name} - ${item.capacity} ${item.capacityUnit} @ ${item.venueName}`
                              ) : (
                                `${item.username} (${item.email}) - ${item.role} @ ${item.venueName}`
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadErrors.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-md">
                      <h5 className="text-sm font-medium text-red-800 mb-2">
                        Errors ({uploadErrors.length})
                      </h5>
                      <div className="max-h-40 overflow-y-auto">
                        <div className="space-y-2">
                          {uploadErrors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              <strong>Row {error.row}:</strong> {error.errors.join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {parsedData.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={processBulkUpload}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Upload {parsedData.length} {bulkUploadType === 'generator' ? 'Generator' : 'User'}{parsedData.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Upload Progress */}
              {uploadStatus === 'uploading' && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Uploading {bulkUploadType === 'generator' ? 'Generators' : 'Users'}</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">{uploadProgress}% complete</p>
                </div>
              )}

              {/* Step 5: Upload Complete */}
              {uploadStatus === 'complete' && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Upload Complete</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-md text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResults.success}</div>
                      <div className="text-sm text-green-700">Successful</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-md text-center">
                      <div className="text-2xl font-bold text-red-600">{uploadResults.failed}</div>
                      <div className="text-sm text-red-700">Failed</div>
                    </div>
                  </div>

                  {uploadErrors.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-md">
                      <h5 className="text-sm font-medium text-red-800 mb-2">Upload Errors</h5>
                      <div className="max-h-40 overflow-y-auto">
                        <div className="space-y-1">
                          {uploadErrors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              {error.errors[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={resetBulkUpload}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Upload More
                    </button>
                    <button
                      onClick={closeBulkUploadModal}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Log Modal */}
      {showManualLogModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Manual Log Entry</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleManualLogSubmit} className="space-y-4">
              {/* Generator Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generator <span className="text-red-500">*</span>
                </label>
                <select
                  value={manualLogForm.gensetId}
                  onChange={(e) => setManualLogForm({ ...manualLogForm, gensetId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Generator</option>
                  {gensets.map((genset) => (
                    <option key={genset._id} value={genset._id}>
                      {genset.name} - {genset.venue?.name || 'No Venue'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  value={manualLogForm.action}
                  onChange={(e) => setManualLogForm({ ...manualLogForm, action: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MANUAL">Manual Entry</option>
                  <option value="TURN_ON">Turn On</option>
                  <option value="TURN_OFF">Turn Off</option>
                  <option value="CREATED">Created</option>
                  <option value="UPDATED">Updated</option>
                </select>
              </div>

              {/* Custom Timestamp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Timestamp (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={manualLogForm.customTimestamp}
                  onChange={(e) => setManualLogForm({ ...manualLogForm, customTimestamp: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use current time
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={manualLogForm.notes}
                  onChange={(e) => setManualLogForm({ ...manualLogForm, notes: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter detailed notes about this log entry..."
                  required
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {manualLogForm.notes.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={submitting || !manualLogForm.gensetId || !manualLogForm.notes.trim()}
                >
                  {submitting ? 'Creating...' : 'Create Log Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Log Modal */}
      {showEditLogModal && editingLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Log Entry</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditLogSubmit} className="space-y-4">
              {/* Generator Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generator <span className="text-red-500">*</span>
                </label>
                <select
                  value={editLogForm.gensetId}
                  onChange={(e) => setEditLogForm({ ...editLogForm, gensetId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Generator</option>
                  {gensets.map((genset) => (
                    <option key={genset._id} value={genset._id}>
                      {genset.name} - {genset.venue?.name || 'No Venue'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  value={editLogForm.action}
                  onChange={(e) => setEditLogForm({ ...editLogForm, action: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MANUAL">Manual Entry</option>
                  <option value="TURN_ON">Turn On</option>
                  <option value="TURN_OFF">Turn Off</option>
                  <option value="CREATED">Created</option>
                  <option value="UPDATED">Updated</option>
                </select>
              </div>

              {/* Custom Timestamp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Timestamp (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={editLogForm.customTimestamp}
                  onChange={(e) => setEditLogForm({ ...editLogForm, customTimestamp: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use current time
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editLogForm.notes}
                  onChange={(e) => setEditLogForm({ ...editLogForm, notes: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter detailed notes about this log entry..."
                  required
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editLogForm.notes.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={submitting || !editLogForm.gensetId || !editLogForm.notes.trim()}
                >
                  {submitting ? 'Updating...' : 'Update Log Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Log Confirmation Modal */}
      {showDeleteLogModal && deletingLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Log Entry</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Confirm Deletion
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Are you sure you want to delete this log entry? This action cannot be undone.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Log Details:</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Generator:</span> {deletingLog.genset?.name}</p>
                  <p><span className="font-medium">Action:</span> {deletingLog.action.replace('_', ' ')}</p>
                  <p><span className="font-medium">Timestamp:</span> {new Date(deletingLog.timestamp).toLocaleString()}</p>
                  {deletingLog.notes && (
                    <p><span className="font-medium">Notes:</span> {deletingLog.notes}</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteLog}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Deleting...' : 'Delete Log Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
} 