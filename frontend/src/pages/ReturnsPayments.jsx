import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CreditCard,
  Plus,
  Search,
  Fuel,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const ReturnsPayments = ({
  refreshKey,
  isReturnModalOpen,
  setIsReturnModalOpen,
  preselectedBookingForReturn,
  setPreselectedBookingForReturn,
}) => {
  const [activeSubTab, setActiveSubTab] = useState('returns');
  const [returnsList, setReturnsList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Return Form State
  const [returnForm, setReturnForm] = useState({
    booking_id: '',
    odometer_start: 10000,
    odometer_end: 10150,
    fuel_level: 'FULL',
    damage_notes: '',
    late_fee: '0',
    damage_fee: '0',
  });
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Payment Form State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    booking_id: '',
    amount: '',
    payment_type: 'RENTAL',
    payment_method: 'UPI',
    status: 'SUCCESS',
    transaction_reference: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rData, pData, activeB, allB] = await Promise.all([
        api.getReturns(),
        api.getPayments(),
        api.getBookings({ status: 'ACTIVE' }),
        api.getBookings(),
      ]);
      setReturnsList(rData);
      setPaymentsList(pData);
      setActiveBookings(activeB);
      setAllBookings(allB);

      if (activeB.length > 0 && !returnForm.booking_id) {
        setReturnForm((prev) => ({ ...prev, booking_id: activeB[0].booking_id }));
      }
      if (allB.length > 0 && !paymentForm.booking_id) {
        setPaymentForm((prev) => ({ ...prev, booking_id: allB[0].booking_id, amount: allB[0].total_amount }));
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  // When opened with preselected booking from Bookings tab
  useEffect(() => {
    if (preselectedBookingForReturn) {
      setReturnForm((prev) => ({
        ...prev,
        booking_id: preselectedBookingForReturn.booking_id,
      }));
      setIsReturnModalOpen(true);
      setActiveSubTab('returns');
    }
  }, [preselectedBookingForReturn]);

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!returnForm.booking_id) {
      addToast('Please select a booking to return.', 'error');
      return;
    }

    const start = parseInt(returnForm.odometer_start, 10);
    const end = parseInt(returnForm.odometer_end, 10);
    if (end < start) {
      addToast('Odometer end must be greater than or equal to start.', 'error');
      return;
    }

    try {
      setSubmittingReturn(true);
      await api.recordReturn({
        booking_id: parseInt(returnForm.booking_id, 10),
        odometer_start: start,
        odometer_end: end,
        fuel_level: returnForm.fuel_level,
        damage_notes: returnForm.damage_notes || 'No damage reported',
        late_fee: parseFloat(returnForm.late_fee || 0),
        damage_fee: parseFloat(returnForm.damage_fee || 0),
      });

      addToast(`Return processed! Booking #${returnForm.booking_id} completed and vehicle restored to AVAILABLE.`, 'success');
      setIsReturnModalOpen(false);
      setPreselectedBookingForReturn(null);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error', 5000);
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.booking_id || !paymentForm.amount) {
      addToast('Please select booking and enter payment amount.', 'error');
      return;
    }

    try {
      setSubmittingPayment(true);
      await api.recordPayment({
        booking_id: parseInt(paymentForm.booking_id, 10),
        amount: parseFloat(paymentForm.amount),
        payment_type: paymentForm.payment_type,
        payment_method: paymentForm.payment_method,
        status: paymentForm.status,
        transaction_reference: paymentForm.transaction_reference.trim() || undefined,
      });

      addToast(`Payment of ₹${paymentForm.amount} recorded successfully!`, 'success');
      setIsPaymentModalOpen(false);
      setPaymentForm((prev) => ({
        ...prev,
        amount: '',
        transaction_reference: '',
      }));
      fetchData();
    } catch (err) {
      addToast(err.message, 'error', 5000);
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Returns & Financial Ledger</h1>
          <p className="page-description">
            Process vehicle returns, calculate late/damage fees, and maintain payment records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setIsReturnModalOpen(true)} className="btn btn-success">
            <RotateCcw size={16} />
            <span>Process Return</span>
          </button>
          <button onClick={() => setIsPaymentModalOpen(true)} className="btn btn-primary">
            <CreditCard size={16} />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveSubTab('returns')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSubTab === 'returns' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.95rem',
            padding: '0.75rem 1rem',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'returns' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          Check-in Returns ({returnsList.length})
        </button>
        <button
          onClick={() => setActiveSubTab('payments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSubTab === 'payments' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.95rem',
            padding: '0.75rem 1rem',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'payments' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          Payments Ledger ({paymentsList.length})
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      ) : activeSubTab === 'returns' ? (
        /* Returns Table */
        returnsList.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Booking ID</th>
                  <th>Return Timestamp</th>
                  <th>Odometer (Start &rarr; End)</th>
                  <th>Distance Covered</th>
                  <th>Fuel Level</th>
                  <th>Fees</th>
                  <th>Damage Notes</th>
                </tr>
              </thead>
              <tbody>
                {returnsList.map((r) => {
                  const dist = r.odometer_end - r.odometer_start;
                  const totalFees = Number(r.late_fee) + Number(r.damage_fee);
                  return (
                    <tr key={r.return_id}>
                      <td style={{ fontWeight: 700 }}>#{r.return_id}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                          Booking #{r.booking_id}
                        </span>
                      </td>
                      <td>{new Date(r.actual_return_at).toLocaleString()}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace' }}>
                          {r.odometer_start} &rarr; {r.odometer_end} km
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{dist} km</span>
                      </td>
                      <td>
                        <span className="badge badge-info">{r.fuel_level || 'N/A'}</span>
                      </td>
                      <td>
                        {totalFees > 0 ? (
                          <div style={{ color: '#fb7185', fontWeight: 600 }}>
                            ₹{totalFees.toLocaleString('en-IN')}
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Late: ₹{Number(r.late_fee)} | Dam: ₹{Number(r.damage_fee)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: '0.85rem' }}>No extra fees</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '200px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {r.damage_notes || 'Clean'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <RotateCcw className="empty-state-icon" />
            <h3 className="empty-state-title">No Return Records</h3>
            <p className="empty-state-desc">When active vehicles are returned, their inspection data will appear here.</p>
          </div>
        )
      ) : (
        /* Payments Table */
        paymentsList.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Booking ID</th>
                  <th>Transaction Reference</th>
                  <th>Payment Type</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {paymentsList.map((p) => (
                  <tr key={p.payment_id}>
                    <td style={{ fontWeight: 700 }}>#{p.payment_id}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                        Booking #{p.booking_id}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                        {p.transaction_reference || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-primary">{p.payment_type}</span>
                    </td>
                    <td>
                      <span className="badge badge-info">{p.payment_method}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#34d399', fontSize: '1rem' }}>
                        ₹{Number(p.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'SUCCESS' ? 'badge-success' : p.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(p.payment_date).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <CreditCard className="empty-state-icon" />
            <h3 className="empty-state-title">No Payments Recorded</h3>
            <p className="empty-state-desc">Record rental fees or security deposits to view transactions.</p>
          </div>
        )
      )}

      {/* Return Vehicle Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setPreselectedBookingForReturn(null);
        }}
        title="Vehicle Return & Check-in Inspection"
        maxWidth="600px"
      >
        <form onSubmit={handleProcessReturn}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Active / Confirmed Booking *</label>
              <select
                className="form-control"
                value={returnForm.booking_id}
                onChange={(e) => setReturnForm({ ...returnForm, booking_id: e.target.value })}
                required
              >
                <option value="">Select booking...</option>
                {allBookings
                  .filter((b) => b.status === 'ACTIVE' || b.status === 'CONFIRMED')
                  .map((b) => (
                    <option key={b.booking_id} value={b.booking_id}>
                      #{b.booking_id} - {b.customer_name} ({b.brand} {b.model}) [{b.status}]
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Odometer Start (km) *</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={returnForm.odometer_start}
                  onChange={(e) => setReturnForm({ ...returnForm, odometer_start: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Odometer End (km) *</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={returnForm.odometer_end}
                  onChange={(e) => setReturnForm({ ...returnForm, odometer_end: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fuel Level</label>
              <select
                className="form-control"
                value={returnForm.fuel_level}
                onChange={(e) => setReturnForm({ ...returnForm, fuel_level: e.target.value })}
              >
                <option value="FULL">FULL</option>
                <option value="HIGH">HIGH</option>
                <option value="HALF">HALF</option>
                <option value="LOW">LOW</option>
                <option value="EMPTY">EMPTY</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Late Fee (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={returnForm.late_fee}
                  onChange={(e) => setReturnForm({ ...returnForm, late_fee: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Damage Fee (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={returnForm.damage_fee}
                  onChange={(e) => setReturnForm({ ...returnForm, damage_fee: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Condition & Damage Inspection Notes</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Note any scratches, dent, tyre condition or interior cleanliness..."
                value={returnForm.damage_notes}
                onChange={(e) => setReturnForm({ ...returnForm, damage_notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={() => {
                setIsReturnModalOpen(false);
                setPreselectedBookingForReturn(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={submittingReturn} className="btn btn-success">
              {submittingReturn ? <span className="spinner" /> : <span>Process Return & Complete Trip</span>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Booking Payment"
      >
        <form onSubmit={handleRecordPayment}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Select Booking *</label>
              <select
                className="form-control"
                value={paymentForm.booking_id}
                onChange={(e) => {
                  const bId = e.target.value;
                  const b = allBookings.find((x) => String(x.booking_id) === String(bId));
                  setPaymentForm({
                    ...paymentForm,
                    booking_id: bId,
                    amount: b ? b.total_amount : paymentForm.amount,
                  });
                }}
                required
              >
                <option value="">Select booking...</option>
                {allBookings.map((b) => (
                  <option key={b.booking_id} value={b.booking_id}>
                    #{b.booking_id} - {b.customer_name} ({b.brand} {b.model}) - Total: ₹{Number(b.total_amount).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 3600"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-control"
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Type</label>
                <select
                  className="form-control"
                  value={paymentForm.payment_type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                >
                  <option value="RENTAL">Rental Fee</option>
                  <option value="DEPOSIT">Security Deposit</option>
                  <option value="LATE_FEE">Late Fee</option>
                  <option value="DAMAGE">Damage Fee</option>
                  <option value="REFUND">Refund</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction Reference</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Auto-generated if left blank"
                  value={paymentForm.transaction_reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submittingPayment} className="btn btn-primary">
              {submittingPayment ? <span className="spinner" /> : <span>Record Payment</span>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
