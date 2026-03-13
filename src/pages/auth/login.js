/**
 * login.js — MediLink Sign In Page
 * Depends on: api.js (loaded before this file)
 * Path: src/pages/auth/login.js
 */

(function () {
    'use strict';

    const { Auth, AuthAPI } = window.MediLink;

    // ── Redirect if already logged in ────────────────────────────────────────
    if (Auth.isLoggedIn()) {
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = next || '../../index.html';
        return;
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const emailInput    = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const pwToggleBtn   = document.getElementById('pw-toggle');
    const loginBtn      = document.getElementById('btn-login');
    const errorBanner   = document.getElementById('login-error');
    const emailHint     = document.getElementById('email-hint');
    const passwordHint  = document.getElementById('password-hint');

    // ── Password visibility toggle ────────────────────────────────────────────
    pwToggleBtn?.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';
        passwordInput.type  = isHidden ? 'text' : 'password';
        pwToggleBtn.textContent = isHidden ? '🙈' : '👁️';
    });

    // ── Error helpers ─────────────────────────────────────────────────────────
    function showBanner(message) {
        errorBanner.textContent = message;
        errorBanner.classList.add('visible');
        errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideBanner() {
        errorBanner.classList.remove('visible');
        errorBanner.textContent = '';
    }

    function setFieldError(input, hintEl, message) {
        input.classList.add('error');
        hintEl.textContent = message;
        hintEl.classList.add('visible');
    }

    function clearFieldError(input, hintEl) {
        input.classList.remove('error');
        hintEl.textContent = '';
        hintEl.classList.remove('visible');
    }

    function clearAll() {
        hideBanner();
        clearFieldError(emailInput, emailHint);
        clearFieldError(passwordInput, passwordHint);
    }

    // ── Inline validation ─────────────────────────────────────────────────────
    function validate() {
        clearAll();
        let ok = true;

        const email = emailInput?.value?.trim();
        const password = passwordInput?.value;

        if (!email) {
            setFieldError(emailInput, emailHint, 'Email address is required.');
            ok = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError(emailInput, emailHint, 'Please enter a valid email address.');
            ok = false;
        }

        if (!password) {
            setFieldError(passwordInput, passwordHint, 'Password is required.');
            ok = false;
        } else if (password.length < 6) {
            setFieldError(passwordInput, passwordHint, 'Password must be at least 6 characters.');
            ok = false;
        }

        return ok;
    }

    // ── Loading state ─────────────────────────────────────────────────────────
    function setLoading(loading) {
        loginBtn.disabled = loading;
        loginBtn.classList.toggle('loading', loading);
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    async function handleLogin() {
        if (!validate()) return;

        const email    = emailInput.value.trim();
        const password = passwordInput.value;

        setLoading(true);

        try {
            await AuthAPI.login(email, password);

            // Redirect to ?next= param or homepage
            const next = new URLSearchParams(window.location.search).get('next');
            window.location.href = next || '../../../index.html';

        } catch (err) {
            setLoading(false);

            const data = err?.data ?? {};

            // Backend sends various error shapes — handle all
            const message =
                data.detail                         // "No active account found with the given credentials"
                || data.non_field_errors?.[0]
                || data.email?.[0]
                || data.password?.[0]
                || Object.values(data).flat()[0]
                || 'Sign in failed. Please check your credentials and try again.';

            // 401 = wrong credentials; 400 = validation; 403 = unverified
            if (err?.status === 403 || message.toLowerCase().includes('verif')) {
                showBanner('⚠️ Your email address has not been verified. Check your inbox for a verification link.');
            } else if (err?.status === 401 || err?.status === 400) {
                showBanner('Incorrect email or password. Please try again.');
                // Shake the fields for tactile feedback
                [emailInput, passwordInput].forEach(el => {
                    el.style.animation = 'none';
                    el.offsetHeight; // reflow
                    el.style.animation = 'shake 0.4s ease';
                });
            } else {
                showBanner(message);
            }
        }
    }

    // ── Event listeners ───────────────────────────────────────────────────────
    loginBtn?.addEventListener('click', handleLogin);

    // Submit on Enter key in either field
    [emailInput, passwordInput].forEach(input => {
        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter') handleLogin();
        });
        // Clear error on typing
        input?.addEventListener('input', () => {
            clearAll();
        });
    });

    // ── Shake keyframe (injected once) ────────────────────────────────────────
    if (!document.getElementById('shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.textContent = `
            @keyframes shake {
                0%,100% { transform: translateX(0); }
                20%      { transform: translateX(-6px); }
                40%      { transform: translateX(6px); }
                60%      { transform: translateX(-4px); }
                80%      { transform: translateX(4px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Autofocus email ───────────────────────────────────────────────────────
    emailInput?.focus();

}());