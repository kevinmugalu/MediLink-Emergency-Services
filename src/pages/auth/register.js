/**
 * register.js — MediLink Create Account Page
 * Depends on: api.js (loaded before this file)
 * Path: src/pages/auth/register.js
 */

(function () {
    'use strict';

    const { Auth, AuthAPI } = window.MediLink;

    // ── Redirect if already logged in ────────────────────────────────────────
    if (Auth.isLoggedIn()) {
        window.location.href = '../../../index.html';
        return;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    let selectedRole = 'client';

    // ── Role meta ─────────────────────────────────────────────────────────────
    const ROLE_META = {
        client: {
            desc:       'Request ambulances, track arrivals in real time, and choose your preferred hospital.',
            btnLabel:   'Create Patient Account →',
        },
        driver: {
            desc:       'Receive dispatch alerts, update your location, manage availability and trips.',
            btnLabel:   'Apply as Driver →',
        },
        provider: {
            desc:       'Register your organisation to manage your ambulance fleet and incoming bookings.',
            btnLabel:   'Register Organisation →',
        },
    };

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const firstNameInput   = document.getElementById('first_name');
    const lastNameInput    = document.getElementById('last_name');
    const emailInput       = document.getElementById('email');
    const phoneInput       = document.getElementById('phone');
    const passwordInput    = document.getElementById('password');
    const pwToggleBtn      = document.getElementById('pw-toggle');
    const licenseInput     = document.getElementById('license_number');
    const nidaInput        = document.getElementById('nida_number');
    const orgNameInput     = document.getElementById('org_name');
    const districtInput    = document.getElementById('district');
    const termsCheckbox    = document.getElementById('terms');
    const registerBtn      = document.getElementById('btn-register');
    const errorBanner      = document.getElementById('register-error');
    const roleDescEl       = document.getElementById('role-desc');
    const pwStrengthWrap   = document.getElementById('pw-strength-wrap');
    const pwStrengthFill   = document.getElementById('pw-strength-fill');
    const pwStrengthLabel  = document.getElementById('pw-strength-label');
    const driverFields     = document.getElementById('driver-fields');
    const providerFields   = document.getElementById('provider-fields');

    // ── Role tab switching ────────────────────────────────────────────────────
    document.querySelectorAll('.role-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.role-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            selectedRole = this.dataset.role;
            applyRole(selectedRole);
        });
    });

    function applyRole(role) {
        // Update description strip
        if (roleDescEl) roleDescEl.textContent = ROLE_META[role].desc;

        // Update button label
        const btnLabel = registerBtn?.querySelector('.btn-label');
        if (btnLabel) btnLabel.textContent = ROLE_META[role].btnLabel;

        // Toggle extra fields with animation
        driverFields?.classList.toggle('open', role === 'driver');
        providerFields?.classList.toggle('open', role === 'provider');

        // Highlight left panel role preview
        document.querySelectorAll('.role-preview').forEach(card => {
            card.classList.toggle('highlight', card.dataset.for === role);
            const badge = card.querySelector('.rp-badge');
            if (badge) badge.style.display = card.dataset.for === role ? '' : 'none';
        });

        clearAll();
    }

    // Initialise badge visibility on load
    document.querySelectorAll('.role-preview .rp-badge').forEach((badge, i) => {
        if (i > 0) badge.style.display = 'none';
    });

    // ── Password visibility toggle ────────────────────────────────────────────
    pwToggleBtn?.addEventListener('click', () => {
        const hidden = passwordInput.type === 'password';
        passwordInput.type = hidden ? 'text' : 'password';
        pwToggleBtn.textContent = hidden ? '🙈' : '👁️';
    });

    // ── Password strength meter ───────────────────────────────────────────────
    function measureStrength(pw) {
        if (!pw) return { score: 0, label: '', color: '' };
        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        const levels = [
            { label: '',          color: '' },
            { label: 'Weak',      color: '#ef4444' },
            { label: 'Fair',      color: '#f59e0b' },
            { label: 'Good',      color: '#3b82f6' },
            { label: 'Strong',    color: '#22c55e' },
            { label: 'Very strong', color: '#22c55e' },
        ];
        return { score, ...levels[score] };
    }

    passwordInput?.addEventListener('input', () => {
        const pw = passwordInput.value;
        if (!pw) {
            if (pwStrengthWrap) pwStrengthWrap.style.display = 'none';
            return;
        }
        if (pwStrengthWrap) pwStrengthWrap.style.display = 'block';

        const { score, label, color } = measureStrength(pw);
        if (pwStrengthFill) {
            pwStrengthFill.style.width = `${(score / 5) * 100}%`;
            pwStrengthFill.style.background = color;
        }
        if (pwStrengthLabel) {
            pwStrengthLabel.textContent = label;
            pwStrengthLabel.style.color = color;
        }
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

    function setFieldError(inputEl, hintId, message) {
        if (inputEl) inputEl.classList.add('error');
        const hint = document.getElementById(hintId);
        if (hint) {
            hint.textContent = message;
            hint.classList.add('visible');
        }
    }

    function clearFieldError(inputEl, hintId) {
        if (inputEl) inputEl.classList.remove('error');
        const hint = document.getElementById(hintId);
        if (hint) {
            hint.textContent = '';
            hint.classList.remove('visible');
        }
    }

    function clearAll() {
        hideBanner();
        clearFieldError(firstNameInput,  'first-hint');
        clearFieldError(lastNameInput,   'last-hint');
        clearFieldError(emailInput,      'email-hint');
        clearFieldError(phoneInput,      'phone-hint');
        clearFieldError(passwordInput,   'password-hint');
        clearFieldError(licenseInput,    'license-hint');
        clearFieldError(orgNameInput,    'org-hint');
        clearFieldError(null,            'terms-hint');
    }

    // ── Validation ────────────────────────────────────────────────────────────
    function validate() {
        clearAll();
        let ok = true;

        if (!firstNameInput?.value?.trim()) {
            setFieldError(firstNameInput, 'first-hint', 'First name is required.');
            ok = false;
        }

        if (!lastNameInput?.value?.trim()) {
            setFieldError(lastNameInput, 'last-hint', 'Last name is required.');
            ok = false;
        }

        const email = emailInput?.value?.trim();
        if (!email) {
            setFieldError(emailInput, 'email-hint', 'Email address is required.');
            ok = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError(emailInput, 'email-hint', 'Please enter a valid email address.');
            ok = false;
        }

        const phone = phoneInput?.value?.trim();
        if (phone && !/^\+?\d[\d\s]{8,14}$/.test(phone)) {
            setFieldError(phoneInput, 'phone-hint', 'Enter a valid phone number — e.g. +256 700 123456');
            ok = false;
        }

        const pw = passwordInput?.value;
        if (!pw) {
            setFieldError(passwordInput, 'password-hint', 'Password is required.');
            ok = false;
        } else if (pw.length < 8) {
            setFieldError(passwordInput, 'password-hint', 'Password must be at least 8 characters.');
            ok = false;
        }

        // Role-specific validation
        if (selectedRole === 'driver') {
            if (!licenseInput?.value?.trim()) {
                setFieldError(licenseInput, 'license-hint', 'Driver licence number is required.');
                ok = false;
            }
        }

        if (selectedRole === 'provider') {
            if (!orgNameInput?.value?.trim()) {
                setFieldError(orgNameInput, 'org-hint', 'Organisation name is required.');
                ok = false;
            }
        }

        if (!termsCheckbox?.checked) {
            const hint = document.getElementById('terms-hint');
            if (hint) {
                hint.textContent = 'You must agree to the terms to continue.';
                hint.classList.add('visible');
            }
            ok = false;
        }

        return ok;
    }

    // ── Loading state ─────────────────────────────────────────────────────────
    function setLoading(loading) {
        registerBtn.disabled = loading;
        registerBtn.classList.toggle('loading', loading);
    }

    // ── Build payload per role ────────────────────────────────────────────────
    function buildPayload() {
        const base = {
            first_name: firstNameInput.value.trim(),
            last_name:  lastNameInput.value.trim(),
            email:      emailInput.value.trim(),
            password:   passwordInput.value,
        };

        const phone = phoneInput?.value?.trim();
        if (phone) base.phone = phone;

        if (selectedRole === 'driver') {
            base.license_number = licenseInput?.value?.trim() || undefined;
            base.nida_number    = nidaInput?.value?.trim()    || undefined;
        }

        if (selectedRole === 'provider') {
            base.organization_name = orgNameInput?.value?.trim()  || undefined;
            base.district          = districtInput?.value?.trim() || undefined;
        }

        return base;
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    async function handleRegister() {
        if (!validate()) return;

        const payload = buildPayload();
        setLoading(true);

        const registerFn = {
            client:   () => AuthAPI.registerClient(payload),
            driver:   () => AuthAPI.registerDriver(payload),
            provider: () => AuthAPI.registerProvider(payload),
        }[selectedRole] ?? (() => AuthAPI.registerClient(payload));

        try {
            await registerFn();

            // Store email for verify-email page
            // Account is active immediately — go straight to home (or ?next= if set)
            // ?next= is used for redirect after login, e.g. /dashboard.html
            const next = new URLSearchParams(window.location.search).get('next');
            window.location.href = next || '../../../index.html';

        } catch (err) {
            setLoading(false);

            const data = err?.data ?? {};

            // Map backend field errors back to inline hints
            const fieldMap = {
                email:      [emailInput,     'email-hint'],
                first_name: [firstNameInput, 'first-hint'],
                last_name:  [lastNameInput,  'last-hint'],
                phone:      [phoneInput,     'phone-hint'],
                password:   [passwordInput,  'password-hint'],
                license_number: [licenseInput, 'license-hint'],
                organization_name: [orgNameInput, 'org-hint'],
            };

            let handled = false;
            for (const [field, [inputEl, hintId]] of Object.entries(fieldMap)) {
                if (data[field]) {
                    setFieldError(inputEl, hintId, [].concat(data[field]).join(' '));
                    handled = true;
                }
            }

            // Non-field or unknown errors — show banner
            const fallback = data.detail
                || data.non_field_errors?.[0]
                || (!handled && Object.values(data).flat()[0])
                || null;

            if (fallback) {
                showBanner(fallback);
            } else if (!handled) {
                showBanner('Registration failed. Please check your details and try again.');
            }
        }
    }

    // ── Event listeners ───────────────────────────────────────────────────────
    registerBtn?.addEventListener('click', handleRegister);

    // Enter key on any input submits
    document.querySelectorAll('.field-input').forEach(input => {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') handleRegister();
        });
        input.addEventListener('input', clearAll);
    });

    // ── Boot ──────────────────────────────────────────────────────────────────
    applyRole('client');
    firstNameInput?.focus();

}());