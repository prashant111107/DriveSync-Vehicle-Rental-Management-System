import React, { useState, useEffect } from 'react';
import {
  Car,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Wrench,
  PowerOff,
  Fuel,
  Gauge,
  Users,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const Vehicles = ({ refreshKey, isAddModalOpen, setIsAddModalOpen, onBookVehicle }) => {
  const [vehicles, setVehicles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTransmission, setSelectedTransmission] = useState('');
  const [selectedFuel, setSelectedFuel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals state
  const [editVehicle, setEditVehicle] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for new vehicle
  const [newVehicle, setNewVehicle] = useState({
    category_id: 1,
    registration_no: '',
    brand: '',
    model: '',
    manufacture_year: 2024,
    fuel_type: 'PETROL',
    transmission: 'AUTOMATIC',
    seating_capacity: 5,
    daily_rate: '',
    status: 'AVAILABLE',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vData, cData] = await Promise.all([
        api.getVehicles({
          search,
          category_id: selectedCategory,
          transmission: selectedTransmission,
          fuel_type: selectedFuel,
          status: selectedStatus,
        }),
        api.getCategories(),
      ]);
      setVehicles(vData);
      setCategories(cData);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedCategory, selectedTransmission, selectedFuel, selectedStatus, refreshKey]);

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicle.registration_no || !newVehicle.brand || !newVehicle.model || !newVehicle.daily_rate) {
      addToast('Please fill all required fields.', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await api.createVehicle({
        ...newVehicle,
        category_id: parseInt(newVehicle.category_id, 10),
        manufacture_year: parseInt(newVehicle.manufacture_year, 10),
        seating_capacity: parseInt(newVehicle.seating_capacity, 10),
        daily_rate: parseFloat(newVehicle.daily_rate),
      });
      addToast(`Vehicle ${newVehicle.brand} ${newVehicle.model} added successfully!`, 'success');
      setIsAddModalOpen(false);
      setNewVehicle({
        category_id: categories[0]?.category_id || 1,
        registration_no: '',
        brand: '',
        model: '',
        manufacture_year: 2024,
        fuel_type: 'PETROL',
        transmission: 'AUTOMATIC',
        seating_capacity: 5,
        daily_rate: '',
        status: 'AVAILABLE',
      });
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    if (!editVehicle) return;
    try {
      setSubmitting(true);
      await api.updateVehicle(editVehicle.vehicle_id, {
        category_id: parseInt(editVehicle.category_id, 10),
        registration_no: editVehicle.registration_no,
        brand: editVehicle.brand,
        model: editVehicle.model,
        manufacture_year: parseInt(editVehicle.manufacture_year, 10),
        fuel_type: editVehicle.fuel_type,
        transmission: editVehicle.transmission,
        seating_capacity: parseInt(editVehicle.seating_capacity, 10),
        daily_rate: parseFloat(editVehicle.daily_rate),
        status: editVehicle.status,
      });
      addToast('Vehicle updated successfully!', 'success');
      setEditVehicle(null);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (vehicleId, newStatus) => {
    try {
      await api.updateVehicleStatus(vehicleId, newStatus);
      addToast(`Vehicle status changed to ${newStatus}`, 'success');
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteVehicle = async (vehicle) => {
    if (!window.confirm(`Delete ${vehicle.brand} ${vehicle.model} (${vehicle.registration_no})? Vehicles with booking or maintenance history cannot be deleted.`)) return;
    try {
      await api.deleteVehicle(vehicle.vehicle_id);
      addToast('Vehicle deleted successfully.', 'success');
      setEditVehicle(null);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="badge badge-success">Available</span>;
      case 'MAINTENANCE':
        return <span className="badge badge-purple">Maintenance</span>;
      case 'INACTIVE':
        return <span className="badge badge-danger">Inactive</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet Inventory</h1>
          <p className="page-description">
            Explore rental fleet, filter specifications, and manage vehicle operational status.
          </p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Add New Vehicle</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by brand, model, or reg number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.category_name}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={selectedTransmission}
          onChange={(e) => setSelectedTransmission(e.target.value)}
        >
          <option value="">All Transmissions</option>
          <option value="MANUAL">Manual</option>
          <option value="AUTOMATIC">Automatic</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={selectedFuel}
          onChange={(e) => setSelectedFuel(e.target.value)}
        >
          <option value="">All Fuel Types</option>
          <option value="PETROL">Petrol</option>
          <option value="DIESEL">Diesel</option>
          <option value="ELECTRIC">Electric</option>
          <option value="HYBRID">Hybrid</option>
          <option value="CNG">CNG</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Vehicle Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      ) : vehicles.length > 0 ? (
        <div className="vehicle-grid">
          {vehicles.map((v) => (
            <div key={v.vehicle_id} className="vehicle-card">
              <div className="vehicle-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span className="badge badge-info">{v.category_name}</span>
                    {getStatusBadge(v.status)}
                  </div>
                  <h3 className="vehicle-title">{v.brand} {v.model}</h3>
                  <div className="vehicle-reg">{v.registration_no}</div>
                </div>
                <button
                  onClick={() => setEditVehicle(v)}
                  className="btn btn-secondary btn-sm"
                  title="Edit Vehicle"
                >
                  <Edit2 size={13} />
                </button>
              </div>

              <div className="vehicle-card-body">
                <div className="vehicle-specs">
                  <div className="spec-item">
                    <Gauge size={15} />
                    <span>{v.transmission}</span>
                  </div>
                  <div className="spec-item">
                    <Fuel size={15} />
                    <span>{v.fuel_type}</span>
                  </div>
                  <div className="spec-item">
                    <Users size={15} />
                    <span>{v.seating_capacity} Seater</span>
                  </div>
                  <div className="spec-item">
                    <Calendar size={15} />
                    <span>{v.manufacture_year || 'N/A'}</span>
                  </div>
                </div>

                <div className="vehicle-pricing">
                  <span className="price-amount">₹{Number(v.daily_rate).toLocaleString('en-IN')}</span>
                  <span className="price-unit">/ day</span>
                </div>
              </div>

              <div className="vehicle-card-footer">
                <button
                  disabled={v.status !== 'AVAILABLE'}
                  onClick={() => onBookVehicle(v)}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <span>{v.status === 'AVAILABLE' ? 'Book Vehicle' : 'Unavailable'}</span>
                </button>

                {/* Quick status dropdown */}
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                  value={v.status}
                  onChange={(e) => handleQuickStatusChange(v.vehicle_id, e.target.value)}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Car className="empty-state-icon" />
          <h3 className="empty-state-title">No Vehicles Found</h3>
          <p className="empty-state-desc">Try clearing your search filters or add a new vehicle to the fleet.</p>
        </div>
      )}

      {/* Add Vehicle Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Vehicle"
      >
        <form onSubmit={handleCreateVehicle}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-control"
                  value={newVehicle.category_id}
                  onChange={(e) => setNewVehicle({ ...newVehicle, category_id: e.target.value })}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Registration No. *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. MH04XY9999"
                  value={newVehicle.registration_no}
                  onChange={(e) => setNewVehicle({ ...newVehicle, registration_no: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Brand *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tata"
                  value={newVehicle.brand}
                  onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Model *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Nexon"
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fuel Type</label>
                <select
                  className="form-control"
                  value={newVehicle.fuel_type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, fuel_type: e.target.value })}
                >
                  <option value="PETROL">Petrol</option>
                  <option value="DIESEL">Diesel</option>
                  <option value="ELECTRIC">Electric</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="CNG">CNG</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transmission</label>
                <select
                  className="form-control"
                  value={newVehicle.transmission}
                  onChange={(e) => setNewVehicle({ ...newVehicle, transmission: e.target.value })}
                >
                  <option value="AUTOMATIC">Automatic</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Seating Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  className="form-control"
                  value={newVehicle.seating_capacity}
                  onChange={(e) => setNewVehicle({ ...newVehicle, seating_capacity: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Year of Manufacture</label>
                <input
                  type="number"
                  min="1990"
                  max="2030"
                  className="form-control"
                  value={newVehicle.manufacture_year}
                  onChange={(e) => setNewVehicle({ ...newVehicle, manufacture_year: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Daily Rate (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 2500"
                  value={newVehicle.daily_rate}
                  onChange={(e) => setNewVehicle({ ...newVehicle, daily_rate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select
                  className="form-control"
                  value={newVehicle.status}
                  onChange={(e) => setNewVehicle({ ...newVehicle, status: e.target.value })}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <span className="spinner" /> : <span>Add Vehicle</span>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Vehicle Modal */}
      {editVehicle && (
        <Modal
          isOpen={Boolean(editVehicle)}
          onClose={() => setEditVehicle(null)}
          title={`Edit ${editVehicle?.brand || ''} ${editVehicle?.model || ''}`}
        >
          <form onSubmit={handleUpdateVehicle}>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editVehicle?.brand || ''}
                    onChange={(e) => setEditVehicle({ ...editVehicle, brand: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editVehicle?.model || ''}
                    onChange={(e) => setEditVehicle({ ...editVehicle, model: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Daily Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={editVehicle?.daily_rate || ''}
                    onChange={(e) => setEditVehicle({ ...editVehicle, daily_rate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={editVehicle?.status || 'AVAILABLE'}
                    onChange={(e) => setEditVehicle({ ...editVehicle, status: e.target.value })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Transmission</label>
                  <select
                    className="form-control"
                    value={editVehicle?.transmission || 'AUTOMATIC'}
                    onChange={(e) => setEditVehicle({ ...editVehicle, transmission: e.target.value })}
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="AUTOMATIC">Automatic</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fuel Type</label>
                  <select
                    className="form-control"
                    value={editVehicle?.fuel_type || 'PETROL'}
                    onChange={(e) => setEditVehicle({ ...editVehicle, fuel_type: e.target.value })}
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setEditVehicle(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteVehicle(editVehicle)}
                className="btn btn-danger"
              >
                <Trash2 size={14} /> Delete
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? <span className="spinner" /> : <span>Save Changes</span>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};