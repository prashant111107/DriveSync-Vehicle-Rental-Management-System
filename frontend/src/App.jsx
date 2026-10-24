import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Vehicles } from './pages/Vehicles';
import { Bookings } from './pages/Bookings';
import { Customers } from './pages/Customers';
import { ReturnsPayments } from './pages/ReturnsPayments';
import { Maintenance } from './pages/Maintenance';
import { Reports } from './pages/Reports';
import { api } from './services/api';

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { addToast } = useToast();

  // Shared Modals state
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Preselections across views
  const [preselectedVehicle, setPreselectedVehicle] = useState(null);
  const [preselectedBookingForReturn, setPreselectedBookingForReturn] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setDbStatus(data);
      return data.status === 'healthy';
    } catch {
      setDbStatus({ status: 'degraded', database: 'disconnected' });
      return false;
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30s heartbeat
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey((key) => key + 1);
    const isHealthy = await checkHealth();
    setIsRefreshing(false);
    if (isHealthy) {
      addToast('Page data refresh requested. Database connection is healthy.', 'info');
    } else {
      addToast('Unable to refresh: backend or database connection is unavailable.', 'error');
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Executive Overview';
      case 'vehicles':
        return 'Fleet & Vehicle Management';
      case 'bookings':
        return 'Bookings & Reservations';
      case 'customers':
        return 'Customer Database & Licences';
      case 'returns_payments':
        return 'Returns & Payments Ledger';
      case 'maintenance':
        return 'Fleet Maintenance & Servicing';
      case 'reports':
        return 'Analytical Reports';
      default:
        return 'Dashboard';
    }
  };

  const handleBookVehicleFromFleet = (vehicle) => {
    setPreselectedVehicle(vehicle);
    setActiveTab('bookings');
  };

  const handleOpenReturnModal = (booking) => {
    setPreselectedBookingForReturn(booking);
    setActiveTab('returns_payments');
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-content">
        <Navbar
          title={getPageTitle()}
          dbStatus={dbStatus}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="content-body">
          {activeTab === 'dashboard' && (
            <Dashboard
              refreshKey={refreshKey}
              setActiveTab={setActiveTab}
              openNewBookingModal={() => {
                setActiveTab('bookings');
                setIsNewBookingOpen(true);
              }}
              openNewVehicleModal={() => {
                setActiveTab('vehicles');
                setIsAddVehicleOpen(true);
              }}
              openNewCustomerModal={() => {
                setActiveTab('customers');
                setIsAddCustomerOpen(true);
              }}
            />
          )}

          {activeTab === 'vehicles' && (
            <Vehicles
              refreshKey={refreshKey}
              isAddModalOpen={isAddVehicleOpen}
              setIsAddModalOpen={setIsAddVehicleOpen}
              onBookVehicle={handleBookVehicleFromFleet}
            />
          )}

          {activeTab === 'bookings' && (
            <Bookings
              refreshKey={refreshKey}
              isNewBookingOpen={isNewBookingOpen}
              setIsNewBookingOpen={setIsNewBookingOpen}
              preselectedVehicle={preselectedVehicle}
              setPreselectedVehicle={setPreselectedVehicle}
              onOpenReturnModal={handleOpenReturnModal}
            />
          )}

          {activeTab === 'customers' && (
            <Customers
              refreshKey={refreshKey}
              isAddModalOpen={isAddCustomerOpen}
              setIsAddModalOpen={setIsAddCustomerOpen}
            />
          )}

          {activeTab === 'returns_payments' && (
            <ReturnsPayments
              refreshKey={refreshKey}
              isReturnModalOpen={isReturnModalOpen}
              setIsReturnModalOpen={setIsReturnModalOpen}
              preselectedBookingForReturn={preselectedBookingForReturn}
              setPreselectedBookingForReturn={setPreselectedBookingForReturn}
            />
          )}

          {activeTab === 'maintenance' && <Maintenance refreshKey={refreshKey} />}

          {activeTab === 'reports' && <Reports refreshKey={refreshKey} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
