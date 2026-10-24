import React from 'react';
import {
  LayoutDashboard,
  Car,
  CalendarCheck,
  Users,
  CreditCard,
  Wrench,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vehicles', label: 'Fleet & Vehicles', icon: Car },
    { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'returns_payments', label: 'Returns & Payments', icon: CreditCard },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-container">
        <div className="brand-icon-wrapper">
          <Car size={22} color="#fff" />
        </div>
        <div>
          <div className="brand-title">DriveSync</div>
          <div className="brand-subtitle">DBMS Rental System</div>
        </div>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>PostgreSQL 18.6</span>
        </div>
        <div>FastAPI &bull; psycopg 3 &bull; React</div>
      </div>
    </aside>
  );
};
