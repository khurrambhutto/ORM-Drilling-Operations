import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';

function SiteHeader() {
  const { user, logout } = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();

  // Reusable style helpers
  const baseBtn = {
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10,
    fontSize: 14,
    lineHeight: 1,
    padding: '8px 18px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid transparent',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    transition: 'background .18s, color .18s, box-shadow .18s'
  };

  const primaryBtn = {
    ...baseBtn,
    background: 'linear-gradient(140deg,#1d86f5 0%,#1761c1 100%)',
    border: '1px solid #2278e4',
    boxShadow: '0 4px 14px -2px rgba(0,115,230,0.45)'
  };
  const successBtn = {
    ...baseBtn,
    background: 'linear-gradient(140deg,#00c79b 0%,#009b77 100%)',
    border: '1px solid #00b28a',
    boxShadow: '0 4px 14px -2px rgba(0,180,135,0.45)'
  };
  const dangerOutline = {
    ...baseBtn,
    background: 'transparent',
    border: '1px solid #ff6b6b',
    color: '#ff6b6b'
  };

  const navLinkStyle = (active) => ({
    ...baseBtn,
    background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.15)',
    fontWeight: 600,
    padding: '8px 16px',
    textDecoration: 'none'
  });

  const isDashboard = location.pathname.startsWith('/dashboard');
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <header style={{ 
      position:'sticky', 
      top:0, 
      zIndex:100, 
      width:'100%', 
      background:'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)', 
      backdropFilter:'blur(12px)', 
      borderBottom:'2px solid rgba(59, 130, 246, 0.2)', 
      boxShadow:'0 8px 32px rgba(0, 0, 0, 0.3)' 
    }}>
      <div style={{ 
        display:'flex', 
        alignItems:'center', 
        gap:20, 
        padding:'8px 24px', 
        minHeight:72,
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <Link to="/" aria-label="OGDC The Energy Home" style={{ display:'inline-flex', textDecoration:'none' }}>
          <img 
            src="/images/landing/OGDC%20Logo/OGDC%20Logo%20+%20Slogan.png" 
            alt="OGDC The Energy" 
            style={{ 
              height:60, 
              width:'auto', 
              display:'block', 
              objectFit:'contain',
              filter: 'brightness(1.1)'
            }} 
            onError={(e)=>{ e.currentTarget.src='/images/landing/OGDC%20Logo/OGDC%20Logo.png'; }} 
          />
        </Link>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:16 }}>
          {/* Navigation group */}
          {user && (
            <div style={{ 
              display:'flex', 
              alignItems:'center', 
              gap:8, 
              padding:'6px 12px', 
              background:'rgba(59, 130, 246, 0.1)', 
              border:'2px solid rgba(59, 130, 246, 0.2)', 
              borderRadius:16,
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.1)'
            }}>
              <button 
                onClick={()=>navigate('/dashboard')} 
                style={{
                  ...navLinkStyle(isDashboard),
                  background: isDashboard ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                  border: isDashboard ? '2px solid #3b82f6' : '2px solid transparent'
                }}
              >
                Dashboard
              </button>
              {user.IsAdmin && (
                <button 
                  onClick={()=>navigate('/admin')} 
                  style={{ 
                    ...navLinkStyle(isAdmin),
                    background: isAdmin ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    border: isAdmin ? '2px solid #3b82f6' : '2px solid transparent'
                  }}
                >
                  Admin
                </button>
              )}
            </div>
          )}

          {/* Brand / product name */}
          <Link to="/" style={{ 
            color:'#fff', 
            fontWeight:900, 
            letterSpacing:1, 
            textDecoration:'none', 
            fontSize:20, 
            lineHeight:1,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            PetroServ
          </Link>

          {/* User badge & actions */}
          {user && (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ 
                display:'flex', 
                alignItems:'center', 
                gap:8, 
                background:'rgba(59, 130, 246, 0.1)', 
                padding:'8px 16px', 
                borderRadius:24, 
                fontSize:14, 
                fontWeight:600, 
                color:'#e2e8f0', 
                letterSpacing:.5,
                border: '2px solid rgba(59, 130, 246, 0.2)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
              }}>
                <span style={{ color:'#fff', fontWeight:800 }}>{user.Username}</span>
                {user.IsAdmin && (
                  <span style={{ 
                    background:'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                    color:'#fff', 
                    padding:'4px 10px', 
                    borderRadius:12, 
                    fontSize:11, 
                    fontWeight:800, 
                    letterSpacing:.8,
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                  }}>
                    ADMIN
                  </span>
                )}
              </div>
              <button
                onClick={()=>{ logout(); navigate('/login'); }}
                style={{
                  ...dangerOutline,
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                  border: '2px solid #ef4444',
                  color: '#fca5a5',
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: 12,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e=>{ 
                  e.currentTarget.style.background='linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'; 
                  e.currentTarget.style.color='#fff';
                  e.currentTarget.style.transform='translateY(-1px)';
                  e.currentTarget.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.4)';
                }} 
                onMouseLeave={e=>{ 
                  e.currentTarget.style.background='linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)'; 
                  e.currentTarget.style.color='#fca5a5';
                  e.currentTarget.style.transform='translateY(0)';
                  e.currentTarget.style.boxShadow='none';
                }}
              >
                Logout
              </button>
            </div>
          )}
          {!user && (
            <button 
              onClick={()=>navigate('/login')} 
              style={{
                ...successBtn,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: '2px solid #10b981',
                padding: '8px 16px',
                borderRadius: 12,
                fontWeight: 700,
                transition: 'all 0.3s ease'
              }} 
              onMouseEnter={e=>{ 
                e.currentTarget.style.filter='brightness(1.1)'; 
                e.currentTarget.style.transform='translateY(-1px)';
                e.currentTarget.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)';
              }} 
              onMouseLeave={e=>{ 
                e.currentTarget.style.filter=''; 
                e.currentTarget.style.transform='translateY(0)';
                e.currentTarget.style.boxShadow='0 4px 14px -2px rgba(0,180,135,0.45)';
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
