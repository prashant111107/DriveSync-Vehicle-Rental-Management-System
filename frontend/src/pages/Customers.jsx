import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Phone,
  FileText,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const Customers = ({ refreshKey, isAddModalOpen, setIsAddModalOpen }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState('');
  const { addToast } = useToast();

  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    email: '',
    phone: '',
    licence_number: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterVerified !== '') params.verified = filterVerified === 'true';

      const data = await api.getCustomers(params);
      setCustomers(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, filterVerified, refreshKey]);

  const handleRegisterCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.full_name || !newCustomer.email || !newCustomer.phone || !newCustomer.licence_number) {
      addToast('Please fill all required customer fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.registerCustomer(newCustomer);
      addToast(`Customer ${newCustomer.full_name} registered successfully!`, 'success');
      setIsAddModalOpen(false);
      setNewCustomer({
        full_name: '',
        email: '',
        phone: '',
        licence_number: '',
      });
      fetchCustomers();
    } catch (err) {
      addToast(err.message, 'error', 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerification = async (customer) => {
    const nextState = !customer.licence_verified;
    try {
      await api.verifyCustomer(customer.customer_id, nextState);
      addToast(
        `Driving licence for ${customer.full_name} ${nextState ? 'VERIFIED' : 'UNVERIFIED'}.`,
        nextState ? 'success' : 'info'
      );
      fetchCustomers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Directory</h1>
          <p className="page-description">
            Manage customer profiles, verify driving licences, and view rental histories.
          </p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Register Customer</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, email, phone, or licence number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={filterVerified}
          onChange={(e) => setFilterVerified(e.target.value)}
        >
          <option value="">All Verification Statuses</option>
          <option value="true">Verified Licences</option>
          <option value="false">Unverified Licences</option>
        </select>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      ) : customers.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Full Name</th>
                <th>Contact Info</th>
                <th>Driving Licence</th>
                <th>Licence Verification</th>
                <th>Registered On</th>
                <th style={{ textAlign: 'right' }}>Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customer_id}>
                  <td style={{ fontWeight: 700 }}>#{c.customer_id}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{c.full_name}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                      <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>{c.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>{c.phone}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={14} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.licence_number}</span>
                    </div>
                  </td>
                  <td>
                    {c.licence_verified ? (
                      <span className="badge badge-success">
                        <ShieldCheck size={13} /> Verified
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <ShieldAlert size={13} /> Unverified
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleToggleVerification(c)}
                        className={`btn btn-sm ${c.licence_verified ? 'btn-secondary' : 'btn-success'}`}
                      >
                        {c.licence_verified ? 'Revoke Verification' : 'Verify Licence'}
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
          <Users className="empty-state-icon" />
          <h3 className="empty-state-title">No Customers Found</h3>
          <p className="empty-state-desc">Register a new customer or adjust your search filters.</p>
        </div>
      )}

      {/* Register Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Customer"
      >
        <form onSubmit={handleRegisterCustomer}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Vikram Malhotra"
                value={newCustomer.full_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. vikram@example.com"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9876543210"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Driving Licence Number *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MH-01-2023-000456"
                value={newCustomer.licence_number}
                onChange={(e) => setNewCustomer({ ...newCustomer, licence_number: e.target.value })}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Licence will be initially unverified. You can verify it from the customer directory.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <span className="spinner" /> : <span>Register Customer</span>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
