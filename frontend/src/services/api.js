const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      let errorMsg = 'An unexpected error occurred';
      if (data && data.detail) {
        if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') + ': ' : ''}${d.msg}`).join('; ');
        }
      }
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    if (data === null) {
      throw new Error('The backend returned an invalid response. Check the API server and proxy configuration.');
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Unable to connect to the backend server. Is FastAPI running on port 8000?');
    }
    throw err;
  }
}

export const api = {
  // Health
  getHealth: async () => {
    const response = await fetch('/health');
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.detail || `Health check failed (${response.status})`);
    }
    if (!data?.status) {
      throw new Error('The backend returned an invalid health response.');
    }
    return data;
  },

  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),

  // Vehicles
  getVehicles: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/vehicles?${qs.toString()}`);
  },
  getCategories: () => request('/vehicles/categories'),
  getVehicle: (id) => request(`/vehicles/${id}`),
  createVehicle: (data) => request('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (id, data) => request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateVehicleStatus: (id, status) => request(`/vehicles/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Customers
  getCustomers: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/customers?${qs.toString()}`);
  },
  getCustomer: (id) => request(`/customers/${id}`),
  registerCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  verifyCustomer: (id, licence_verified) =>
    request(`/customers/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ licence_verified }) }),

  // Bookings
  getBookings: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/bookings?${qs.toString()}`);
  },
  getBooking: (id) => request(`/bookings/${id}`),
  getBookingHistory: (id) => request(`/bookings/${id}/history`),
  createBooking: (data) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBookingStatus: (id, status, note = null) =>
    request(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  cancelBooking: (id, note = null) => {
    const qs = note ? `?note=${encodeURIComponent(note)}` : '';
    return request(`/bookings/${id}/cancel${qs}`, { method: 'POST' });
  },

  // Payments
  getPayments: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/payments?${qs.toString()}`);
  },
  recordPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Returns
  getReturns: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/returns?${qs.toString()}`);
  },
  getReturnByBooking: (bookingId) => request(`/returns/${bookingId}`),
  recordReturn: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),

  // Maintenance
  getMaintenance: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/maintenance?${qs.toString()}`);
  },
  createMaintenance: (data) => request('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
  updateMaintenance: (id, data) => request(`/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Reports
  getMonthlyRevenueReport: () => request('/reports/monthly-revenue'),
  getPopularVehiclesReport: () => request('/reports/popular-vehicles'),
  getCustomerHistoryReport: () => request('/reports/customer-history'),
  getOutstandingPaymentsReport: () => request('/reports/outstanding-payments'),
  getVehicleUtilizationReport: () => request('/reports/vehicle-utilization'),
};
