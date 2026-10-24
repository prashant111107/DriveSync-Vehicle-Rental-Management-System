import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Car,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const Maintenance = ({ refreshKey }) => {
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const { addToast } = useToast();

  // Create Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    vehicle_id: '',
    description: '',
    start_at: '',
    cost: '0',
    status: 'IN_PROGRESS',
  });
  const [submitting, setSubmitting] = useState(false);

  // Update Modal
  const [editRecord, setEditRecord] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    status: 'COMPLETED',
    cost: '0',
    description: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mData, vData] = await Promise.all([
        api.getMaintenance({ status: statusFilter }),
        api.getVehicles(),
      ]);
      setMaintenanceList(mData);
      setVehicles(vData);

      if (vData.length > 0 && !newRecord.vehicle_id) {
        setNewRecord((prev) => ({ ...prev, vehicle_id: vData[0].vehicle_id }));
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

  // Set default start_at when opening add modal
  useEffect(() => {
    if (isAddModalOpen && !newRecord.start_at) {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      setNewRecord((prev) => ({
        ...prev,
        start_at: new Date(now.getTime() - offset).toISOString().slice(0, 16),
      }));
    }
  }, [isAddModalOpen]);

  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    if (!newRecord.vehicle_id || !newRecord.description || !newRecord.start_at) {
      addToast('Please complete all maintenance fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.createMaintenance({
        vehicle_id: parseInt(newRecord.vehicle_id, 10),
        description: newRecord.description.trim(),
        start_at: new Date(newRecord.start_at).toISOString(),
        cost: parseFloat(newRecord.cost || 0),
        status: newRecord.status,
      });

      addToast(`Maintenance scheduled for vehicle!`, 'success');
      setIsAddModalOpen(false);
      setNewRecord({
        vehicle_id: vehicles[0]?.vehicle_id || '',
        description: '',
        start_at: '',
        cost: '0',
        status: 'IN_PROGRESS',
      });
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (record) => {
    setEditRecord(record);
    setUpdateForm({
      status: record.status === 'SCHEDULED' ? 'IN_PROGRESS' : 'COMPLETED',
      cost: record.cost,
      description: record.description,
    });
  };

  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editRecord) return;

    try {
      setSubmitting(true);
      const payload = {
        status: updateForm.status,
        cost: parseFloat(updateForm.cost || 0),
        description: updateForm.description,
      };
      if (updateForm.status === 'COMPLETED') {
        payload.end_at = new Date().toISOString();
      }

      await api.updateMaintenance(editRecord.maintenance_id, payload);
      addToast(
        `Maintenance #${editRecord.maintenance_id} updated. ${updateForm.status === 'COMPLETED' ? 'Vehicle restored to AVAILABLE.' : ''}`,
        'success'
      );
      setEditRecord(null);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return <span className="badge badge-warning">Scheduled</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-purple">In Progress</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">Completed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet Service & Maintenance</h1>
          <p className="page-description">
            Track vehicle periodic servicing, engine repairs, and inspection costs.
          </p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Schedule Service</span>
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
          <option value="">All Service Statuses</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Total records: <strong>{maintenanceList.length}</strong>
        </div>
      </div>

      {/* Maintenance Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      ) : maintenanceList.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Vehicle</th>
                <th>Description</th>
                <th>Start Date</th>
                <th>Completed Date</th>
                <th>Service Cost</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceList.map((m) => (
                <tr key={m.maintenance_id}>
                  <td style={{ fontWeight: 700 }}>#{m.maintenance_id}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      {m.brand} {m.model}
                    </div>
                    <div className="vehicle-reg">{m.registration_no}</div>
                  </td>
                  <td style={{ maxWidth: '240px' }}>
                    <span style={{ fontSize: '0.88rem' }}>{m.description}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem' }}>{new Date(m.start_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </td>
                  <td>
                    {m.end_at ? (
                      <span style={{ fontSize: '0.82rem' }}>{new Date(m.end_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Ongoing</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>₹{Number(m.cost).toLocaleString('en-IN')}</span>
                  </td>
                  <td>{getStatusBadge(m.status)}</td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {m.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="btn btn-success btn-sm"
                        >
                          <CheckCircle2 size={13} />
                          <span>Update / Complete</span>
                        </button>
                      ) : (
                        <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>Resolved</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Wrench className="empty-state-icon" />
          <h3 className="empty-state-title">No Maintenance Records</h3>
          <p className="empty-state-desc">All vehicles in the fleet are currently operational.</p>
        </div>
      )}

      {/* Schedule Maintenance Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Fleet Maintenance"
      >
        <form onSubmit={handleCreateMaintenance}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Select Vehicle *</label>
              <select
                className="form-control"
                value={newRecord.vehicle_id}
                onChange={(e) => setNewRecord({ ...newRecord, vehicle_id: e.target.value })}
                required
              >
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.brand} {v.model} ({v.registration_no}) - Current: {v.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Service Description *</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="e.g. 20,000 km general service, engine oil change, brake pad replacement..."
                value={newRecord.description}
                onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Service Start Date & Time *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={newRecord.start_at}
                  onChange={(e) => setNewRecord({ ...newRecord, start_at: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Estimated / Current Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={newRecord.cost}
                  onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Initial Status</label>
              <select
                className="form-control"
                value={newRecord.status}
                onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
              >
                <option value="IN_PROGRESS">In Progress (Sets vehicle status to MAINTENANCE)</option>
                <option value="SCHEDULED">Scheduled</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <span className="spinner" /> : <span>Schedule Service</span>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Maintenance Modal */}
      {editRecord && (
        <Modal
          isOpen={Boolean(editRecord)}
          onClose={() => setEditRecord(null)}
          title={`Update Service #${editRecord.maintenance_id} (${editRecord.brand} ${editRecord.model})`}
        >
          <form onSubmit={handleUpdateRecord}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                >
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed (Restores vehicle to AVAILABLE)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Total Final Service Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={updateForm.cost}
                  onChange={(e) => setUpdateForm({ ...updateForm, cost: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Work Completed Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={updateForm.description}
                  onChange={(e) => setUpdateForm({ ...updateForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setEditRecord(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn btn-success">
                {submitting ? <span className="spinner" /> : <span>Update Record</span>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
