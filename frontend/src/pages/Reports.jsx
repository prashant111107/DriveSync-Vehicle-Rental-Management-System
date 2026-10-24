import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Award,
  Users,
  Clock,
  Car,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

export const Reports = ({ refreshKey }) => {
  const [activeReport, setActiveReport] = useState('monthly_revenue');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchReport = async () => {
    try {
      setLoading(true);
      let res = [];
      if (activeReport === 'monthly_revenue') {
        res = await api.getMonthlyRevenueReport();
      } else if (activeReport === 'popular_vehicles') {
        res = await api.getPopularVehiclesReport();
      } else if (activeReport === 'customer_history') {
        res = await api.getCustomerHistoryReport();
      } else if (activeReport === 'outstanding_payments') {
        res = await api.getOutstandingPaymentsReport();
      } else if (activeReport === 'vehicle_utilization') {
        res = await api.getVehicleUtilizationReport();
      }
      setData(res);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport, refreshKey]);

  const reportTabs = [
    { id: 'monthly_revenue', label: 'Monthly Revenue', icon: DollarSign },
    { id: 'popular_vehicles', label: 'Popular Vehicles', icon: Award },
    { id: 'customer_history', label: 'Customer Booking History', icon: Users },
    { id: 'outstanding_payments', label: 'Outstanding Balances', icon: AlertCircle },
    { id: 'vehicle_utilization', label: 'Fleet Utilization', icon: Car },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">DBMS Analytics & Reports</h1>
          <p className="page-description">
            Analytical insights queried from PostgreSQL database views and aggregated joins.
          </p>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.65rem 1.15rem' }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div className="spinner" style={{ width: '36px', height: '36px' }} />
          </div>
        ) : (
          <div>
            {/* 1. Monthly Revenue */}
            {activeReport === 'monthly_revenue' && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Monthly Revenue Breakdown</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Aggregated successful payments grouped by billing month, type, and transaction method.
                  </p>
                </div>

                {data.length > 0 ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Billing Month</th>
                          <th>Payment Type</th>
                          <th>Payment Method</th>
                          <th>Transaction Count</th>
                          <th style={{ textAlign: 'right' }}>Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{row.month_year}</td>
                            <td><span className="badge badge-primary">{row.payment_type}</span></td>
                            <td><span className="badge badge-info">{row.payment_method}</span></td>
                            <td>{row.total_transactions} txns</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: '1rem' }}>
                              ₹{Number(row.total_amount).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No successful payment transactions recorded for this period.</p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Popular Vehicles */}
            {activeReport === 'popular_vehicles' && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Vehicle Popularity & Rental Demand</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Fleet ranking by reservation demand, cumulative booking revenue, and average rental period.
                  </p>
                </div>

                {data.length > 0 ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Vehicle</th>
                          <th>Registration</th>
                          <th>Category</th>
                          <th>Total Bookings</th>
                          <th>Gross Value</th>
                          <th>Avg Rental Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, idx) => (
                          <tr key={row.vehicle_id}>
                            <td style={{ fontWeight: 700, color: idx === 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                              #{idx + 1}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: '#fff' }}>{row.brand} {row.model}</span>
                            </td>
                            <td><span className="vehicle-reg">{row.registration_no}</span></td>
                            <td><span className="badge badge-info">{row.category_name}</span></td>
                            <td><strong style={{ fontSize: '1rem' }}>{row.total_bookings}</strong> trips</td>
                            <td style={{ fontWeight: 700, color: '#38bdf8' }}>
                              ₹{Number(row.gross_booking_value).toLocaleString('en-IN')}
                            </td>
                            <td>{row.avg_rental_days} days / trip</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No vehicle rental booking records found.</p>
                  </div>
                )}
              </div>
            )}

            {/* 3. Customer Booking History */}
            {activeReport === 'customer_history' && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Customer Loyalty & Booking Activity</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Customer lifetime spend, completed trips, and cancellation ratios.
                  </p>
                </div>

                {data.length > 0 ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Licence Status</th>
                          <th>Phone</th>
                          <th>Total Bookings</th>
                          <th>Completed Trips</th>
                          <th>Cancelled Trips</th>
                          <th style={{ textAlign: 'right' }}>Lifetime Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row) => (
                          <tr key={row.customer_id}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#fff' }}>{row.full_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.email}</div>
                            </td>
                            <td>
                              {row.licence_verified ? (
                                <span className="badge badge-success">Verified</span>
                              ) : (
                                <span className="badge badge-danger">Unverified</span>
                              )}
                            </td>
                            <td>{row.phone}</td>
                            <td><strong>{row.total_bookings}</strong></td>
                            <td><span style={{ color: '#34d399', fontWeight: 600 }}>{row.completed_trips}</span></td>
                            <td><span style={{ color: '#fb7185' }}>{row.cancelled_trips}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontSize: '1rem' }}>
                              ₹{Number(row.total_spend).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No customer history available.</p>
                  </div>
                )}
              </div>
            )}

            {/* 4. Outstanding Payments */}
            {activeReport === 'outstanding_payments' && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Outstanding Balances & Pending Invoices</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Reservations with remaining unpaid balances (Booking Amount minus Successful Payments).
                  </p>
                </div>

                {data.length > 0 ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Booking</th>
                          <th>Customer</th>
                          <th>Vehicle</th>
                          <th>Total Amount</th>
                          <th>Amount Paid</th>
                          <th>Outstanding Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row) => (
                          <tr key={row.booking_id}>
                            <td style={{ fontWeight: 700 }}>#{row.booking_id}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{row.customer_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.customer_phone}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{row.vehicle_name}</div>
                              <div className="vehicle-reg">{row.registration_no}</div>
                            </td>
                            <td>₹{Number(row.total_amount).toLocaleString('en-IN')}</td>
                            <td style={{ color: '#34d399' }}>₹{Number(row.amount_paid).toLocaleString('en-IN')}</td>
                            <td>
                              <span style={{ fontWeight: 800, color: '#fb7185', fontSize: '1.05rem' }}>
                                ₹{Number(row.outstanding_balance).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td><span className="badge badge-warning">{row.booking_status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <CheckCircle2 className="empty-state-icon" style={{ color: '#34d399' }} />
                    <h3 className="empty-state-title">All Invoices Settled</h3>
                    <p className="empty-state-desc">There are no outstanding balances on confirmed or active bookings.</p>
                  </div>
                )}
              </div>
            )}

            {/* 5. Vehicle Utilization */}
            {activeReport === 'vehicle_utilization' && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Fleet Utilization & Downtime Metrics</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Total days rented on road vs maintenance downtime and servicing expenditures.
                  </p>
                </div>

                {data.length > 0 ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Vehicle</th>
                          <th>Registration</th>
                          <th>Current Status</th>
                          <th>Completed / Active Trips</th>
                          <th>Total Days Rented</th>
                          <th>Maintenance Count</th>
                          <th style={{ textAlign: 'right' }}>Total Service Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row) => (
                          <tr key={row.vehicle_id}>
                            <td>
                              <span style={{ fontWeight: 600, color: '#fff' }}>{row.brand} {row.model}</span>
                            </td>
                            <td><span className="vehicle-reg">{row.registration_no}</span></td>
                            <td>
                              <span className={`badge ${row.current_status === 'AVAILABLE' ? 'badge-success' : row.current_status === 'MAINTENANCE' ? 'badge-purple' : 'badge-danger'}`}>
                                {row.current_status}
                              </span>
                            </td>
                            <td><strong>{row.completed_or_active_trips}</strong> trips</td>
                            <td>
                              <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                                {row.total_days_rented} days
                              </span>
                            </td>
                            <td>{row.maintenance_count} times</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#fb7185' }}>
                              ₹{Number(row.total_maintenance_cost).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No utilization data recorded yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
