'use client';

import { useState } from 'react';

export default function GeneratorCard({ genset, onToggle, canToggle = true }) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (!canToggle || isToggling) return;
    
    setIsToggling(true);
    try {
      await onToggle(genset._id);
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

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {genset.name}
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {genset.model} • {genset.serialNumber}
            </p>
            <p className="text-sm text-gray-500">
              {genset.capacity} {genset.capacityUnit} • {genset.fuelType}
            </p>
            {genset.venue && (
              <p className="text-sm text-gray-500 mt-1">
                📍 {genset.venue.name}
              </p>
            )}
          </div>
          
          <div className="flex flex-col items-end space-y-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(genset.status)}`}>
              {genset.status}
            </span>
            
            {canToggle && (
              <button
                onClick={handleToggle}
                disabled={isToggling}
                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${getToggleButtonColor(genset.status)} focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
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
      </div>
    </div>
  );
} 