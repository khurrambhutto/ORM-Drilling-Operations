import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './auth';
import SiteHeader from './SiteHeader';

// Login page reintroduced: visually mirrors landing page but focuses user on authentication.
export default function LoginPage() {
	const { login, loading } = useAuth();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const videoRef = useRef(null);
	const navigate = useNavigate();
	const location = useLocation();

	useEffect(() => {
		const v = videoRef.current;
		if (!v) return;
		v.muted = false;
		v.play().catch(() => { v.muted = true; v.play().catch(()=>{}); });
	}, []);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await login(username.trim(), password);
			const dest = location.state?.from?.pathname || '/dashboard';
			navigate(dest);
		} catch (er) {
			setError(er.message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div style={{ background:'#0B1328', minHeight:'100vh', color:'#fff', overflow:'hidden' }}>
			<SiteHeader title="" />
			<main style={{ width:'100%', height:'calc(100vh - 70px)', position:'relative' }}>
				<img src="/images/landing/hero.jpg" alt="Background" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:'brightness(0.62)', objectPosition:'center -40px' }} />
				<video
					key="login-bg"
						autoPlay loop playsInline preload="auto" poster="/images/landing/hero.jpg"
						ref={videoRef}
						onError={(e)=>{ e.currentTarget.style.display='none'; }}
						style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:'brightness(0.62)' }}
				>
					<source src="/images/landing/logo%20video.mp4" type="video/mp4" />
				</video>
				<div style={{ position:'absolute', inset:0, display:'flex', justifyContent:'center', alignItems:'center', padding:24 }}>
					<form onSubmit={handleSubmit} style={{ pointerEvents:'auto', width:'100%', maxWidth:430, background:'rgba(10,20,38,0.60)', backdropFilter:'blur(14px) saturate(180%)', WebkitBackdropFilter:'blur(14px) saturate(180%)', border:'1px solid rgba(255,255,255,0.18)', padding:'32px 34px 38px', borderRadius:28, display:'flex', flexDirection:'column', gap:16, boxShadow:'0 18px 48px -6px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.4)' }}>
						<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
							<h1 style={{ margin:0, fontSize:30, fontWeight:800, letterSpacing:1 }}>Sign In</h1>
							<Link to="/" style={{ fontSize:13, color:'#00c79b', textDecoration:'none', fontWeight:600 }}>Back</Link>
						</div>
						<div style={{ fontSize:13, opacity:0.85, letterSpacing:0.5 }}>Access the drilling operations dashboard</div>
						<div style={{ display:'flex', flexDirection:'column', gap:10 }}>
							<input autoFocus placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} required style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:12, padding:'14px 16px', color:'#fff', fontSize:15, outline:'none' }} />
							<input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:12, padding:'14px 16px', color:'#fff', fontSize:15, outline:'none' }} />
						</div>
						{error && <div style={{ color:'#ff7373', fontSize:13 }}>{error}</div>}
						<button type="submit" disabled={submitting || loading} style={{ marginTop:2, padding:'15px 18px', borderRadius:14, background: submitting||loading ? 'linear-gradient(140deg,#6fbca8 0%,#4d8a73 100%)':'linear-gradient(140deg,#00c79b 0%,#009b77 100%)', border:'1px solid #00b28a', color:'#fff', fontWeight:800, letterSpacing:1.2, fontSize:16, cursor: submitting||loading ? 'not-allowed':'pointer', boxShadow:'0 12px 30px -4px rgba(0,180,135,0.55)', transition:'transform .18s, box-shadow .18s' }}
							onMouseEnter={e=>{ if(!(submitting||loading)){ e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 18px 40px -2px rgba(0,180,135,0.70)'; } }}
							onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 12px 30px -4px rgba(0,180,135,0.55)'; }}
						>{(submitting||loading)?'Signing in...':'Sign In'}</button>
						<div style={{ marginTop:8, fontSize:12, opacity:0.65 }}>Need help? Contact an administrator.</div>
					</form>
				</div>
			</main>
		</div>
	);
}
