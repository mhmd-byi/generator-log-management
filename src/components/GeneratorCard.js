'use client';

import { useState } from 'react';

export default function GeneratorCard({ genset, onToggle, canToggle = true }) {
  const [isToggling, setIsToggling] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');

  const handleToggle = async () => {
    if (!canToggle || isToggling) return;
    
    setIsToggling(true);
    setError('');
    try {
      await onToggle(genset._id);
    } catch (err) {
      // Handle API errors
      if (err.response?.data?.code === 'NO_VENUE_ASSIGNED' || err.response?.data?.code === 'VENUE_INACTIVE') {
        setError(err.response.data.error);
      } else {
        setError('Failed to toggle generator status');
      }
    } finally {
      setIsToggling(false);
    }
  };

  const getStatusColor = (status) => {
    return status === 'ON' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const getToggleButtonColor = (status) => {
    return status === 'ON'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
  };

  // Check if generator can be turned on
  const canTurnOn = () => {
    if (genset.status === 'ON') return true; // Can always turn off
    return genset.venue && genset.venue.isActive !== false; // Can only turn on if venue exists and is active
  };

  const getVenueWarning = () => {
    if (!genset.venue) {
      return 'Cannot operate: No venue assigned';
    }
    if (genset.venue.isActive === false) {
      return 'Cannot operate: Venue has been deactivated';
    }
    return null;
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {genset.name}
            </h3>
            {genset.model && (
              <p className="text-sm text-gray-500 truncate">
                {genset.model}
              </p>
            )}
            <p className="text-sm text-gray-500">
              {genset.capacity} {genset.capacityUnit}{genset.fuelType ? ` • ${genset.fuelType}` : ''}
            </p>
            {genset.venue ? (
              <p className={`text-sm mt-1 ${genset.venue.isActive === false ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                📍 {genset.venue.name}
                {genset.venue.isActive === false && ' (Deactivated)'}
              </p>
            ) : (
              <p className="text-sm text-yellow-600 mt-1 font-medium">
                ⚠️ No venue assigned
              </p>
            )}
          </div>
          
          <div className="flex flex-col items-end space-y-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(genset.status)}`}>
              {genset.status}
            </span>
            
            {canToggle && (
              <div className="flex flex-col items-end space-y-2">
                <button
                  onClick={handleToggle}
                  disabled={isToggling || !canTurnOn()}
                  className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
                    !canTurnOn() && genset.status === 'OFF' 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : getToggleButtonColor(genset.status)
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={!canTurnOn() && genset.status === 'OFF' ? getVenueWarning() : ''}
                >
                  {isToggling ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    genset.status === 'ON' ? 'Turn Off' : 'Turn On'
                  )}
                </button>
                
                {/* Venue warning below button */}
                {!canTurnOn() && genset.status === 'OFF' && (
                  <p className="text-xs text-red-600 text-right max-w-32">
                    {getVenueWarning()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {genset.lastStatusChange && (
          <div className="mt-4 text-xs text-gray-500">
            <p>
              Last changed: {new Date(genset.lastStatusChange).toLocaleString()}
              {genset.lastStatusChangedBy && (
                <span> by {genset.lastStatusChangedBy.username}</span>
              )}
            </p>
          </div>
        )}

        {/* Error message display */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Venue History Section */}
        {genset.venueHistory && genset.venueHistory.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center text-xs text-gray-600 hover:text-gray-800"
            >
              <svg 
                className={`h-3 w-3 mr-1 transform transition-transform ${showHistory ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Venue History ({genset.venueHistory.length})
            </button>
            
            {showHistory && (
              <div className="mt-2 space-y-1">
                {genset.venueHistory.slice().reverse().map((history, index) => (
                  <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                                         <div className="flex justify-between items-start">
                       <div>
                         <p className="font-medium text-gray-900">{history.venueName}</p>
                       </div>
                       <div className="text-right text-gray-500">
                         <p>From: {new Date(history.attachedAt).toLocaleDateString()}</p>
                         {history.detachedAt && (
                           <p>To: {new Date(history.detachedAt).toLocaleDateString()}</p>
                         )}
                       </div>
                     </div>
                    {history.detachedReason && history.detachedReason !== 'OTHER' && (
                      <p className="mt-1 text-gray-600">
                        Reason: {history.detachedReason.replace('_', ' ').toLowerCase()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 