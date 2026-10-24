import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Key,
  RotateCcw,
  History,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const Bookings = ({
  isNewBookingOpen,
  refreshKey,
  setIsNewBookingOpen,
  preselectedVehicle,
  setPreselectedVehicle,
  onOpenReturnModal,
}) => {
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const { addToast } = useToast();

  // Audit history modal state
  const [historyBooking, setHistoryBooking] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New Booking form state
  const [bookingForm, setBookingForm] = useState({
    customer_id: '',
    vehicle_id: '',
    pickup_at: '',
    return_at: '',
  });
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Cancel booking modal
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelNote, setCancelNote] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bData, cData, vData] = await Promise.all([
        api.getBookings({ status: statusFilter }),
        api.getCustomers(),
        api.getVehicles(),
      ]);
      setBookings(bData);
      setCustomers(cData);
      setVehicles(vData);

      // Set initial form selection if available
      if (cData.length > 0 && !bookingForm.customer_id) {
        setBookingForm((prev) => ({ ...prev, customer_id: cData[0].customer_id }));
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, refreshKey]);

  // Handle preselected vehicle from Fleet view
  useEffect(() => {
    if (preselectedVehicle) {
      setBookingForm((prev) => ({ ...prev, vehicle_id: preselectedVehicle.vehicle_id }));
      setIsNewBookingOpen(true);
    }
  }, [preselectedVehicle]);

  // Form error state
  const [bookingError, setBookingError] = useState(null);

  // Set default dates if empty
  useEffect(() => {
    if (isNewBookingOpen) {
      setBookingError(null);
      if (!bookingForm.pickup_at || !bookingForm.return_at) {
        // Default to starting tomorrow or finding first free vehicle
        const start = new Date();
        start.setDate(start.getDate() + 3);
        start.setHours(10, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 2);

        const toISOFormat = (d) => {
          const offset = d.getTimezoneOffset() * 60000;
          return new Date(d.getTime() - offset).toISOString().slice(0, 16);
        };

        // Pick vehicle 2 or 4 if vehicle 1 is currently active
        const defaultVeh = vehicles.find(v => v.status === 'AVAILABLE' && v.vehicle_id !== 1) || vehicles[0];

        setBookingForm((prev) => ({
          ...prev,
          pickup_at: toISOFormat(start),
          return_at: toISOFormat(end),
          vehicle_id: prev.vehicle_id || (defaultVeh?.vehicle_id || ''),
        }));
      }
    }
  }, [isNewBookingOpen, vehicles]);

  // Check for live conflict against existing active bookings
  const conflictingBooking = React.useMemo(() => {
    if (!bookingForm.vehicle_id || !bookingForm.pickup_at || !bookingForm.return_at) return null;
    const reqStart = new Date(bookingForm.pickup_at);
    const reqEnd = new Date(bookingForm.return_at);
    if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime()) || reqEnd <= reqStart) return null;

    return bookings.find((b) => {
      if (String(b.vehicle_id) !== String(bookingForm.vehicle_id)) return false;
      if (!['PENDING', 'CONFIRMED', 'ACTIVE'].includes(b.status)) return false;
      const bStart = new Date(b.pickup_at);
      const bEnd = new Date(b.return_at);
      return bStart < reqEnd && bEnd > reqStart;
    });
  }, [bookings, bookingForm.vehicle_id, bookingForm.pickup_at, bookingForm.return_at]);

  // Recalculate duration & price live
  useEffect(() => {
    if (!bookingForm.pickup_at || !bookingForm.return_at || !bookingForm.vehicle_id) {
      setCalculatedDays(0);
      setCalculatedPrice(0);
      return;
    }

    const start = new Date(bookingForm.pickup_at);
    const end = new Date(bookingForm.return_at);
    const diffMs = end - start;

    if (diffMs > 0) {
      const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const veh = vehicles.find((v) => String(v.vehicle_id) === String(bookingForm.vehicle_id));
      const dailyRate = veh ? Number(veh.daily_rate) : 0;
      setCalculatedDays(days);
      setCalculatedPrice(days * dailyRate);
    } else {
      setCalculatedDays(0);
      setCalculatedPrice(0);
    }
  }, [bookingForm.pickup_at, bookingForm.return_at, bookingForm.vehicle_id, vehicles]);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setBookingError(null);

    if (!bookingForm.customer_id || !bookingForm.vehicle_id || !bookingForm.pickup_at || !bookingForm.return_at) {
      setBookingError('Please complete all booking fields.');
      return;
    }

    const start = new Date(bookingForm.pickup_at);
    const end = new Date(bookingForm.return_at);
    if (end <= start) {
      setBookingError('Return date/time must be strictly after pickup date/time.');
      return;
    }

    if (conflictingBooking) {
      setBookingError(
        `Exclusion Conflict: Vehicle is already reserved by ${conflictingBooking.customer_name} from ${new Date(conflictingBooking.pickup_at).toLocaleDateString()} to ${new Date(conflictingBooking.return_at).toLocaleDateString()}. Please select other dates or a different vehicle.`
      );
      return;
    }

    try {
      setSubmitting(true);
      await api.createBooking({
        customer_id: parseInt(bookingForm.customer_id, 10),
        vehicle_id: parseInt(bookingForm.vehicle_id, 10),
        pickup_at: new Date(bookingForm.pickup_at).toISOString(),
        return_at: new Date(bookingForm.return_at).toISOString(),
      });
      addToast('Reservation created successfully! Status: PENDING', 'success');
      setIsNewBookingOpen(false);
      setPreselectedVehicle(null);
      fetchData();
    } catch (err) {
      setBookingError(err.message);
      addToast(err.message, 'error', 6000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusTransition = async (bookingId, newStatus, note = null) => {
    try {
      await api.updateBookingStatus(bookingId, newStatus, note);
      addToast(`Booking #${bookingId} transitioned to ${newStatus}`, 'success');
      fetchData();
    } catch (err) {
      addToast(err.message, 'error', 5000);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    try {
      await api.cancelBooking(cancelModalBooking.booking_id, cancelNote);
      addToast(`Booking #${cancelModalBooking.booking_id} cancelled.`, 'info');
      setCancelModalBooking(null);
      setCancelNote('');
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openAuditHistory = async (booking) => {
    setHistoryBooking(booking);
    setHistoryLoading(true);
    try {
      const logs = await api.getBookingHistory(booking.booking_id);
      setHistoryList(logs);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-warning">Pending</span>;
      case 'CONFIRMED':
        return <span className="badge badge-info">Confirmed</span>;
      case 'ACTIVE':
        return <span className="badge badge-primary">Active</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">Completed</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const selectedCust = customers.find((c) => String(c.customer_id) === String(bookingForm.customer_id));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservations & Bookings</h1>
          <p className="page-description">
            Manage customer reservations, enforce licence checks, and monitor vehicle return status.
          </p>
        </div>
        <button onClick={() => setIsNewBookingOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>New Reservation</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="ACTIVE">Active (On Road)</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{bookings.length}</strong> reservations
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      ) : bookings.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Rental Window</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.booking_id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>#{b.booking_id}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.customer_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                      {b.licence_verified ? (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          <ShieldCheck size={11} /> Verified
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          <ShieldAlert size={11} /> Unverified
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customer_phone}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      {b.brand} {b.model}
                    </div>
                    <div className="vehicle-reg" style={{ marginTop: '0.15rem' }}>{b.registration_no}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>From:</strong> {new Date(b.pickup_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong>To:</strong> {new Date(b.return_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      ₹{Number(b.total_amount).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ₹{Number(b.daily_rate_at_booking).toLocaleString('en-IN')}/day
                    </div>
                  </td>
                  <td>{getStatusBadge(b.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* State transition buttons */}
                      {b.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleStatusTransition(b.booking_id, 'CONFIRMED')}
                            className="btn btn-success btn-sm"
                            title="Confirm Booking (requires verified licence)"
                          >
                            <CheckCircle2 size={13} />
                            <span>Confirm</span>
                          </button>
                          <button
                            onClick={() => setCancelModalBooking(b)}
                            className="btn btn-danger btn-sm"
                            title="Cancel Booking"
                          >
                            <XCircle size={13} />
                          </button>
                        </>
                      )}

                      {b.status === 'CONFIRMED' && (
                        <>
                          <button
                            onClick={() => handleStatusTransition(b.booking_id, 'ACTIVE', 'Vehicle picked up')}
                            className="btn btn-primary btn-sm"
                            title="Customer picked up vehicle"
                          >
                            <Key size={13} />
                            <span>Handover</span>
                          </button>
                          <button
                            onClick={() => setCancelModalBooking(b)}
                            className="btn btn-danger btn-sm"
                            title="Cancel Booking"
                          >
                            <XCircle size={13} />
                          </button>
                        </>
                      )}

                      {b.status === 'ACTIVE' && (
                        <button
                          onClick={() => onOpenReturnModal(b)}
                          className="btn btn-success btn-sm"
                          title="Record return & check-in"
                        >
                          <RotateCcw size={13} />
                          <span>Return Vehicle</span>
                        </button>
                      )}

                      {/* Audit history button */}
                      <button
                        onClick={() => openAuditHistory(b)}
                        className="btn btn-secondary btn-sm"
                        title="View PostgreSQL Trigger Status Audit Log"
                      >
                        <History size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <CalendarCheck className="empty-state-icon" />
          <h3 className="empty-state-title">No Reservations Found</h3>
          <p className="empty-state-desc">Create a new booking or clear existing status filters.</p>
        </div>
      )}

      {/* New Booking Modal */}
      <Modal
        isOpen={isNewBookingOpen}
        onClose={() => {
          setIsNewBookingOpen(false);
          setPreselectedVehicle(null);
        }}
        title="Create New Vehicle Reservation"
        maxWidth="600px"
      >
        <form onSubmit={handleCreateBooking}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Select Customer *</label>
              <select
                className="form-control"
                value={bookingForm.customer_id}
                onChange={(e) => setBookingForm({ ...bookingForm, customer_id: e.target.value })}
                required
              >
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.full_name} ({c.licence_verified ? 'Verified' : 'Unverified Licence'}) - {c.phone}
                  </option>
                ))}
              </select>
              {selectedCust && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                  {selectedCust.licence_verified ? (
                    <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ShieldCheck size={14} /> Driving licence verified ({selectedCust.licence_number})
                    </span>
                  ) : (
                    <span style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertCircle size={14} /> Note: Customer licence is unverified. Admin verification will be required before confirming!
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Select Vehicle *</label>
              <select
                className="form-control"
                value={bookingForm.vehicle_id}
                onChange={(e) => setBookingForm({ ...bookingForm, vehicle_id: e.target.value })}
                required
              >
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id} disabled={v.status !== 'AVAILABLE'}>
                    {v.brand} {v.model} ({v.registration_no}) - ₹{Number(v.daily_rate).toLocaleString('en-IN')}/day {v.status !== 'AVAILABLE' ? `[${v.status}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Pickup Date & Time *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={bookingForm.pickup_at}
                  onChange={(e) => setBookingForm({ ...bookingForm, pickup_at: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Return Date & Time *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={bookingForm.return_at}
                  onChange={(e) => setBookingForm({ ...bookingForm, return_at: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Price Preview Card */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginTop: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculated Rental Duration</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Estimated Cost</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                  ₹{calculatedPrice.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => {
                setIsNewBookingOpen(false);
                setPreselectedVehicle(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting || calculatedDays <= 0} className="btn btn-primary">
              {submitting ? <span className="spinner" /> : <span>Confirm Reservation</span>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Booking Modal */}
      {cancelModalBooking && (
        <Modal
          isOpen={Boolean(cancelModalBooking)}
          onClose={() => setCancelModalBooking(null)}
          title={`Cancel Booking #${cancelModalBooking.booking_id}`}
        >
          <div className="modal-body">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Are you sure you want to cancel the reservation for <strong>{cancelModalBooking.customer_name}</strong> ({cancelModalBooking.brand} {cancelModalBooking.model})?
            </p>
            <div className="form-group">
              <label className="form-label">Cancellation Reason / Note</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Optional reason for cancellation..."
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button onClick={() => setCancelModalBooking(null)} className="btn btn-secondary">
              Keep Booking
            </button>
            <button onClick={handleConfirmCancel} className="btn btn-danger">
              Cancel Reservation
            </button>
          </div>
        </Modal>
      )}

      {/* Audit History Modal */}
      {historyBooking && (
        <Modal
          isOpen={Boolean(historyBooking)}
          onClose={() => setHistoryBooking(null)}
          title={`Status History Audit: Booking #${historyBooking.booking_id}`}
          maxWidth="600px"
        >
          <div className="modal-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Logged automatically by PostgreSQL trigger <code style={{ color: 'var(--primary)', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>trg_booking_status_history</code> in table <code style={{ color: 'var(--accent-cyan)' }}>booking_status_history</code>.
            </p>

            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="spinner" />
              </div>
            ) : historyList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historyList.map((log) => (
                  <div
                    key={log.history_id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{log.old_status || 'NEW'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{log.new_status}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(log.changed_at).toLocaleString()}
                      </div>
                    </div>
                    {log.note && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                        {log.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No status transition logged yet. Booking is currently in initial PENDING state.</p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button onClick={() => setHistoryBooking(null)} className="btn btn-secondary">
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
