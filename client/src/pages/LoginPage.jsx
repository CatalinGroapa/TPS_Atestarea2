import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'
import '../../styles/login.css'

export default function LoginPage() {
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [message, setMessage] = useState({ text: '', type: '' })
  const navigate = useNavigate()

  function setMsg(text, type = '') {
    setMessage({ text, type })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setMsg('')
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), loginPassword)
      setMsg('Autentificare reusita. Redirect...', 'success')
      setTimeout(() => navigate('/'), 350)
    } catch (error) {
      setMsg(`Login esuat: ${error.message}`, 'error')
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setMsg('')
    if (regName.trim().length < 2) {
      setMsg('Numele este prea scurt.', 'error')
      return
    }
    if (regPassword.length < 6) {
      setMsg('Parola trebuie sa aiba minim 6 caractere.', 'error')
      return
    }
    if (regPassword !== regPasswordConfirm) {
      setMsg('Parolele nu coincid.', 'error')
      return
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.trim().toLowerCase(), regPassword)
      if (cred.user) {
        await updateProfile(cred.user, { displayName: regName.trim() })
      }
      setMsg('Cont creat. Redirect...', 'success')
      setTimeout(() => navigate('/'), 350)
    } catch (error) {
      setMsg(`Inregistrare esuata: ${error.message}`, 'error')
    }
  }

  async function handleGoogle() {
    setMsg('')
    try {
      await signInWithPopup(auth, googleProvider)
      setMsg('Login Google reusit. Redirect...', 'success')
      setTimeout(() => navigate('/'), 250)
    } catch (error) {
      setMsg(`Google login esuat: ${error.message}`, 'error')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img
          className="auth-logo"
          src="/images/logo.svg"
          alt="Pulse-Radar"
        />
        <p className="auth-subtitle">
          Conecteaza-te pentru a accesa compararea inteligenta de preturi.
        </p>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            type="button"
            onClick={() => { setTab('login'); setMsg('') }}
          >
            Logare
          </button>
          <button
            className={`auth-tab${tab === 'register' ? ' active' : ''}`}
            type="button"
            onClick={() => { setTab('register'); setMsg('') }}
          >
            Inregistrare
          </button>
        </div>

        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <label className="field-label" htmlFor="loginEmail">Email</label>
            <input
              id="loginEmail"
              className="field-input"
              type="email"
              required
              placeholder="exemplu@email.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <label className="field-label" htmlFor="loginPassword">Parola</label>
            <input
              id="loginPassword"
              className="field-input"
              type="password"
              required
              placeholder="Parola"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button className="submit-btn" type="submit">Intra in cont</button>
          </form>
        )}

        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <label className="field-label" htmlFor="registerName">Nume</label>
            <input
              id="registerName"
              className="field-input"
              type="text"
              required
              placeholder="Nume complet"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
            />
            <label className="field-label" htmlFor="registerEmail">Email</label>
            <input
              id="registerEmail"
              className="field-input"
              type="email"
              required
              placeholder="exemplu@email.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <label className="field-label" htmlFor="registerPassword">Parola</label>
            <input
              id="registerPassword"
              className="field-input"
              type="password"
              required
              placeholder="Minim 6 caractere"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
            />
            <label className="field-label" htmlFor="registerPasswordConfirm">Confirma parola</label>
            <input
              id="registerPasswordConfirm"
              className="field-input"
              type="password"
              required
              placeholder="Repeta parola"
              value={regPasswordConfirm}
              onChange={(e) => setRegPasswordConfirm(e.target.value)}
            />
            <button className="submit-btn" type="submit">Creeaza cont</button>
          </form>
        )}

        <div className="social-login">
          <p className="social-title">Sau logheaza-te cu una din:</p>
          <div className="social-options">
            <button
              id="googleLoginBtn"
              className="social-option"
              type="button"
              title="Google"
              onClick={handleGoogle}
            >
              <img src="/images/Google__G__logo.svg.png" alt="Google" />
              <span>Google</span>
            </button>
          </div>
        </div>

        <p
          id="authMessage"
          className={`auth-message${message.type ? ` ${message.type}` : ''}`}
          aria-live="polite"
        >
          {message.text}
        </p>
      </section>
    </main>
  )
}
