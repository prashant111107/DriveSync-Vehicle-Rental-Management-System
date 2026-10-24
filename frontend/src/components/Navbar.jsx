import React from 'react';
import { Database, RefreshCw } from 'lucide-react';

export const Navbar = ({ title, dbStatus, onRefresh, isRefreshing }) => {
  const isHealthy = dbStatus?.status === 'healthy';

  return (
    <header className="top-header">
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{title}</h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className={`db-indicator ${isHealthy ? '' : 'disconnected'}`}>
          <div className="pulse-dot" />
          <Database size={14} />
          <span>
            {isHealthy ? `vehicle_rental_db (Connected)` : 'Database Disconnected'}
          </span>
        </div>

        <button
          onClick={onRefresh}
          className="btn btn-secondary btn-sm"
          title="Refresh Data"
          disabled={isRefreshing}
        >
          <RefreshCw size={15} className={isRefreshing ? 'spinner' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
