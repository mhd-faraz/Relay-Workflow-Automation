import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, GitBranch, Play, CheckSquare, Zap, LogOut, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { getRuns } from '../services/api';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/workflows', icon: GitBranch,       label: 'Workflows'  },
  { to: '/runs',      icon: Play,            label: 'Runs'       },
  { to: '/approvals', icon: CheckSquare,     label: 'Approvals'  },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [runningCount, setRunningCount] = useState(0);

  useEffect(() => {
    const checkRunning = () => {
      getRuns({ status: 'running' }).then((res) => {
        setRunningCount(res.data.data?.length || 0);
      }).catch(() => {});
    };
    checkRunning();
    const interval = setInterval(checkRunning, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '22px 20px 18px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <div style={{
            width: 34,
            height: 34,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--accent-light)',
          }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Relay</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.8px', fontWeight: 500 }}>WORKFLOW ENGINE</div>
          </div>
        </div>
      </div>

      {/* System status */}
      <div style={{
        margin: '16px 16px 0',
        padding: '10px 12px',
        borderRadius: 8,
        background: runningCount > 0 ? 'var(--info-light)' : 'var(--bg-card)',
        border: `1px solid ${runningCount > 0 ? 'var(--info)' : 'var(--border)'}30`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: runningCount > 0 ? 'var(--info)' : 'var(--success)',
          animation: runningCount > 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
          {runningCount > 0 ? `${runningCount} workflow${runningCount > 1 ? 's' : ''} running` : 'All systems idle'}
        </span>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '16px 12px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <motion.div
                whileHover={{ x: 3 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '14px',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={17} />
                {label}
              </motion.div>
            )}
          </NavLink>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          <div style={{
            padding: '14px',
            borderRadius: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Activity size={13} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Quick tip</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Use webhooks to trigger workflows directly from your own systems.
            </div>
          </div>
        </div>
      </nav>

      {/* User + Logout */}
      <div style={{
        padding: '14px',
        borderTop: '1px solid var(--border)',
      }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '6px 6px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '11px',
            borderRadius: 8,
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid var(--border)',
          }}
        >
          <LogOut size={15} /> Log out
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </motion.aside>
  );
};

export default Sidebar;