import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import './styles/landing.css';
import SiteHeader from './SiteHeader';

function LandingPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const location = useLocation();
  const { token, user, login } = useAuth() || {};
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      // If blocked, keep muted to allow silent autoplay; user can refresh/interact later.
      v.muted = true;
      v.play().catch(() => {});
    });
  }, []);

  return (
    <div style={{ background: '#0B1328', height: '100vh', overflow: 'hidden', color: '#fff' }}>
      <SiteHeader title="" />
      <main style={{ width: '100%', margin: 0, padding: 0 }}>
        <section
          style={{
            position: 'relative',
            borderRadius: 0,
            overflow: 'hidden',
            height: 'calc(100vh - 70px)',
            border: 'none',
            boxShadow: 'none',
            width: '100vw',
            marginLeft: 'calc(50% - 50vw)',
            marginRight: 'calc(50% - 50vw)'
          }}
        >
          {/* Background video (logo animation). Keep image as fallback underneath. */}
          <img
            src="/images/landing/hero.jpg"
            alt="OGDC The Energy Background"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center -40px', position: 'absolute', inset: 0, filter: 'brightness(0.62)' }}
          />
          <video
            key="landing-bg-video"
            autoPlay
            loop
            // intentionally not muted to have sound by default (may require gesture on some browsers)
            playsInline
            preload="auto"
            poster="/images/landing/hero.jpg"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.62)', background: '#000' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            ref={videoRef}
          >
            <source src="/images/landing/logo%20video.mp4" type="video/mp4" />
            {/* Optional future formats: <source src="/images/landing/logo-video.webm" type="video/webm" /> */}
          </video>
          {/* No overlay; silent fallback handled automatically if autoplay with sound is blocked */}

          {/* Overlay container for CTA + inline login */}
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center', padding:'40px 24px', zIndex:3, pointerEvents:'none' }}>
            <div style={{ display:'flex', gap:32, flexWrap:'wrap', alignItems:'flex-end', justifyContent:'center', maxWidth:1100, width:'100%' }}>
              {/* Removed inline login & dashboard button for unauthenticated users. Use header Sign In now. */}
              {token && (
                <div style={{ pointerEvents:'auto', color:'#b2e7d9', fontWeight:600, fontSize:15, background:'rgba(0,0,0,0.35)', padding:'14px 20px', border:'1px solid rgba(255,255,255,0.15)', borderRadius:14 }}>
                  Signed in as <span style={{ color:'#fff' }}>{user?.Username}</span>. <button onClick={()=>navigate('/dashboard')} style={{ background:'none', border:'none', color:'#00c79b', cursor:'pointer', fontWeight:700, textDecoration:'underline', padding:0 }}>Open Dashboard</button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
