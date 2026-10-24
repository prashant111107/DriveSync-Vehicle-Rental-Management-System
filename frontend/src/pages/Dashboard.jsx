import React, { useState, useEffect } from 'react';
import {
  Car,
  CalendarCheck,
  CreditCard,
  Users,
  Clock,
  ArrowRight,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

export const Dashboard = ({ refreshKey, setActiveTab, openNewBookingModal, openNewVehicleModal }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { addToast } = useToast();

  const fetchStats = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      setLoadError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  if (loadError && !stats) {
    return (
      <div className="empty-state" role="alert">
        <AlertTriangle className="empty-state-icon" />
        <h1 className="empty-state-title">Dashboard data unavailable</h1>
        <p className="empty-state-desc">{loadError}</p>
        <button onClick={fetchStats} className="btn btn-primary">Try again</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner" style={{ width: '36px', height: '36px' }} />
      </div>
    );
  }

  const vStats = stats?.vehicles || {};
  const bStats = stats?.bookings || {};
  const rStats = stats?.revenue || {};
  const cStats = stats?.customers || {};

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
      case 'COMPLETED':
      case 'SUCCESS':
        return <span className="badge badge-success">{status}</span>;
      case 'CONFIRMED':
      case 'ACTIVE':
        return <span className="badge badge-info">{status}</span>;
      case 'PENDING':
      case 'SCHEDULED':
        return <span className="badge badge-warning">{status}</span>;
      case 'MAINTENANCE':
        return <span className="badge badge-purple">{status}</span>;
      case 'CANCELLED':
      case 'FAILED':
      case 'INACTIVE':
        return <span className="badge badge-danger">{status}</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-description">
            Live overview of fleet operations, active reservations, and financial performance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={openNewBookingModal} className="btn btn-primary">
            <CalendarCheck size={16} />
            <span>New Booking</span>
          </button>
          <button onClick={openNewVehicleModal} className="btn btn-secondary">
            <Car size={16} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid">
        <div className="card stat-card" style={{ '--stat-accent': 'var(--primary)', '--stat-bg': 'rgba(99, 102, 241, 0.15)' }}>
          <div className="stat-icon">
            <Car size={26} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{vStats.available ?? 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {vStats.total ?? 0}</span></div>
            <div className="stat-label">Available Fleet</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-cyan)', '--stat-bg': 'rgba(6, 182, 212, 0.15)' }}>
          <div className="stat-icon">
            <CalendarCheck size={26} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{vStats.rented ?? bStats.active ?? 0}</div>
            <div className="stat-label">Vehicles Rented</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-amber)', '--stat-bg': 'rgba(245, 158, 11, 0.15)' }}>
          <div className="stat-icon">
            <Clock size={26} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{bStats.pending ?? 0}</div>
            <div className="stat-label">Pending Approval</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-emerald)', '--stat-bg': 'rgba(16, 185, 129, 0.15)' }}>
          <div className="stat-icon">
            <CreditCard size={26} />
          </div>
          <div className="stat-content">
            <div className="stat-value">₹{Number(rStats.total_revenue || 0).toLocaleString('en-IN')}</div>
            <div className="stat-label">Total Revenue Collected</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-purple)', '--stat-bg': 'rgba(168, 85, 247, 0.15)' }}>
          <div className="stat-icon">
            <Users size={26} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{cStats.verified ?? 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {cStats.total ?? 0}</span></div>
            <div className="stat-label">Verified Customers</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-rose)', '--stat-bg': 'rgba(244, 63, 94, 0.15)' }}>
          <div className="stat-icon"><AlertTriangle size={26} /></div>
          <div className="stat-content">
            <div className="stat-value">{bStats.overdue ?? 0}</div>
            <div className="stat-label">Overdue Returns</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-amber)', '--stat-bg': 'rgba(245, 158, 11, 0.15)' }}>
          <div className="stat-icon"><CreditCard size={26} /></div>
          <div className="stat-content">
            <div className="stat-value">₹{Number(rStats.pending_revenue || 0).toLocaleString('en-IN')}</div>
            <div className="stat-label">Pending Payments ({rStats.pending_count ?? 0})</div>
          </div>
        </div>

        <div className="card stat-card" style={{ '--stat-accent': 'var(--accent-purple)', '--stat-bg': 'rgba(168, 85, 247, 0.15)' }}>
          <div className="stat-icon"><Wrench size={26} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats?.maintenance?.total ?? 0}</div>
            <div className="stat-label">Maintenance Alerts</div>
          </div>
        </div>
      </div>

      {(stats?.overdue_returns?.length > 0 || stats?.maintenance_alerts?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {stats?.overdue_returns?.length > 0 && (
            <section className="card" aria-labelledby="overdue-title">
              <h3 id="overdue-title" style={{ marginBottom: '0.75rem' }}>Overdue returns</h3>
              {stats.overdue_returns.map((item) => (
                <div key={item.booking_id} style={{ padding: '0.65rem 0', borderTop: '1px solid var(--border-color)' }}>
                  <strong>Booking #{item.booking_id}</strong> · {item.customer_name}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {item.vehicle_name} ({item.registration_no}) · Due {new Date(item.return_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </section>
          )}
          {stats?.maintenance_alerts?.length > 0 && (
            <section className="card" aria-labelledby="maintenance-title">
              <h3 id="maintenance-title" style={{ marginBottom: '0.75rem' }}>Maintenance alerts</h3>
              {stats.maintenance_alerts.map((item) => (
                <div key={item.maintenance_id} style={{ padding: '0.65rem 0', borderTop: '1px solid var(--border-color)' }}>
                  <strong>{item.vehicle_name}</strong> · {item.status}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {item.description} · {new Date(item.start_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {/* Main Grid: Recent Bookings & Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Bookings */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Recent Reservations</h3>
            <button
              onClick={() => setActiveTab('bookings')}
              className="btn btn-secondary btn-sm"
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {stats?.recent_bookings?.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_bookings.map((b) => (
                    <tr key={b.booking_id}>
                      <td style={{ fontWeight: 600 }}>#{b.booking_id}</td>
                      <td>{b.customer_name}</td>
                      <td style={{ color: 'var(--accent-cyan)' }}>{b.vehicle_name}</td>
                      <td style={{ fontWeight: 600 }}>₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                      <td>{getStatusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No recent reservations found.</p>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Recent Payments</h3>
            <button
              onClick={() => setActiveTab('returns_payments')}
              className="btn btn-secondary btn-sm"
            >
              <span>Ledger</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {stats?.recent_payments?.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref / Type</th>
                    <th>Booking</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_payments.map((p) => (
                    <tr key={p.payment_id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.transaction_reference || `PAY-${p.payment_id}`}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.payment_type}</div>
                      </td>
                      <td>#{p.booking_id}</td>
                      <td style={{ fontWeight: 700, color: '#34d399' }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-primary">{p.payment_method}</span></td>
                      <td>{getStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No payment records available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
