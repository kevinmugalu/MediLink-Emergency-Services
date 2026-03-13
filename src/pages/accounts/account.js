/**
 * account.js — MediLink Account Page
 * Depends on: api.js (loaded before this file)
 * Path: src/pages/account/account.js
 */

(function () {
    'use strict';

    const { Auth, AuthAPI, BookingsAPI } = window.MediLink;

    // ── Auth guard ────────────────────────────────────────────────────────────
    const guard = document.getElementById('auth-guard');

    if (!Auth.isLoggedIn()) {
        window.location.href = `../auth/login.html?next=${encodeURIComponent(window.location.href)}`;
        return;
    }

    function hideGuard() {
        guard?.classList.add('hidden');
        setTimeout(() => guard?.remove(), 400);
    }

    // ── State ─────────────────────────────────────────────────────────────────
    let currentUser    = null;
    let allBookings    = [];
    let activeFilter   = 'all';

    // ── Role display map ──────────────────────────────────────────────────────
    const ROLE_LABELS = {
        client:         'Patient',
        driver:         'Ambulance Driver',
        provider_admin: 'Provider Admin',
        staff:          'Staff / Operator',
        admin:          'Super Admin',
    };

    // ── Tab switching ─────────────────────────────────────────────────────────
    document.querySelectorAll('.side-link[data-tab]').forEach(btn => {
        btn.addEventListener('click', function () {
            switchTab(this.dataset.tab);
        });
    });

    // Also wire the "View all →" shortcut inside overview
    document.querySelectorAll('[data-tab]').forEach(element => {
        if (element.classList.contains('block-link')) {
            element.addEventListener('click', () => switchTab(element.dataset.tab));
        }
    });

    function switchTab(tabId) {
        document.querySelectorAll('.side-link').forEach(button => button.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

        const btn   = document.querySelector(`.side-link[data-tab="${tabId}"]`);
        const panel = document.getElementById(`tab-${tabId}`);

        btn?.classList.add('active');
        panel?.classList.add('active');

        // Lazy-load bookings tab
        if (tabId === 'bookings' && !allBookings.length) {
            loadAllBookings();
        }
    }

    // Initialise 
    async function init() {
        try {
            currentUser = await AuthAPI.me();
        } catch (_) {
            // Token may have expired mid-session
            Auth.clear();
            window.location.href = '../auth/login.html';
            return;
        }

        populateSidebar(currentUser);
        populateOverview(currentUser);
        populateProfileForm(currentUser);
        loadRecentBookings();
        hideGuard();
    }

    // Sidebar 
    function populateSidebar(user) {
        const initials = getInitials(user);
        const name     = user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.email;
        const role     = ROLE_LABELS[user.role] || user.role;

        setEl('sidebar-avatar', initials);
        setEl('sidebar-name',   name);
        setEl('sidebar-role',   role);
    }

    //  Overview tab 
    function populateOverview(user) {
        const name    = user.full_name || user.first_name || 'there';
        const role    = ROLE_LABELS[user.role] || user.role;
        const since   = user.created_at
            ? new Date(user.created_at).toLocaleDateString('en-UG', { year: 'numeric', month: 'long' })
            : '—';

        setEl('overview-greeting',  `Welcome back, ${name.split(' ')[0]}`);
        setEl('overview-since',     `Member since ${since}`);

        // Identity card
        setEl('id-avatar',          getInitials(user));
        setEl('id-name',            name);
        setEl('id-email',           user.email);
        setEl('id-role-tag',        role);
        setEl('id-uid',             user.id?.slice(0, 8).toUpperCase() || '—');

        const statusTag = document.getElementById('id-status-tag');
        if (statusTag) {
            statusTag.textContent = user.is_active ? 'Active' : 'Inactive';
            statusTag.classList.toggle('inactive', !user.is_active);
        }

        document.getElementById('id-avatar').style.background =
            roleColor(user.role);
    }

    // ── Recent bookings (overview preview) ───────────────────────────────────
    async function loadRecentBookings() {
        const container = document.getElementById('recent-bookings');
        if (!container) return;

        try {
            const res  = await BookingsAPI.list();
            allBookings = res.results ?? res;

            // Update badge
            const active = allBookings.filter(b =>
                ['pending','confirmed','dispatched','ongoing'].includes(b.status)
            ).length;
            const badge = document.getElementById('bookings-badge');
            if (badge && active > 0) {
                badge.textContent = active;
                badge.style.display = '';
            }

            // Stats
            setEl('stat-bookings',  allBookings.length);
            setEl('stat-completed', allBookings.filter(b => b.status === 'completed').length);
            setEl('stat-active',    active);

            const hospitals = new Set(allBookings.map(b => b.hospital?.id).filter(Boolean));
            setEl('stat-hospitals', hospitals.size);

            // Recent 5
            const recent = allBookings.slice(0, 5);
            if (!recent.length) return; // leave empty state

            container.innerHTML = recent.map(renderBookingRow).join('');
            attachBookingClicks(container);

        } catch (err) {
            console.warn('Could not load bookings:', err);
        }
    }

    // ── All bookings tab ──────────────────────────────────────────────────────
    async function loadAllBookings() {
        const container = document.getElementById('all-bookings');
        if (!container) return;

        if (!allBookings.length) {
            try {
                const res = await BookingsAPI.list();
                allBookings = res.results ?? res;
            } catch (_) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div>Could not load bookings.</div>`;
                return;
            }
        }

        renderFilteredBookings();

        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', function () {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                activeFilter = this.dataset.filter;
                renderFilteredBookings();
            });
        });
    }

    function renderFilteredBookings() {
        const container = document.getElementById('all-bookings');
        if (!container) return;

        const filtered = activeFilter === 'all'
            ? allBookings
            : allBookings.filter(b => b.status === activeFilter);

        if (!filtered.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🚑</div>
                    No ${activeFilter === 'all' ? '' : activeFilter + ' '}bookings found.
                    ${activeFilter === 'all' ? `<a href="../booking/booking.html" class="btn btn-red" style="margin-top:12px;font-size:13px;">Book an ambulance</a>` : ''}
                </div>`;
            return;
        }

        container.innerHTML = filtered.map(renderBookingRow).join('');
        attachBookingClicks(container);
    }

    function renderBookingRow(b) {
        const date = b.created_at
            ? new Date(b.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
        const provider  = b.ambulance?.provider?.name || '—';
        const hospital  = b.hospital?.name || 'No hospital selected';
        const statusCls = b.status || 'pending';
        const statusLbl = b.status_display || b.status || 'Pending';

        return `
        <div class="booking-row" data-id="${b.id}" data-ref="${b.reference}">
            <div class="brow-icon">🚑</div>
            <div class="brow-info">
                <div class="brow-ref">${b.reference || 'ML-????'}</div>
                <div class="brow-detail">${provider} · ${hospital}</div>
            </div>
            <div class="brow-right">
                <div class="brow-status ${statusCls}">${statusLbl}</div>
                <div class="brow-date">${date}</div>
            </div>
        </div>`;
    }

    function attachBookingClicks(container) {
        container.querySelectorAll('.booking-row').forEach(row => {
            row.addEventListener('click', () => {
                const id  = row.dataset.id;
                const ref = row.dataset.ref;
                window.location.href =
                    `../tracking/tracking.html?id=${id}&ref=${ref}`;
            });
        });
    }

    // ── Profile form ──────────────────────────────────────────────────────────
    function populateProfileForm(user) {
        const profile = user.profile || {};

        setVal('pf-first', user.first_name || '');
        setVal('pf-last',  user.last_name  || '');
        setVal('pf-email', user.email      || '');
        setVal('pf-phone', profile.phone   || '');

        // Show role-specific fields
        if (user.role === 'client') {
            const el = document.getElementById('client-fields');
            if (el) el.style.display = '';
            setVal('pf-whatsapp', profile.whatsapp_number || '');
            setVal('pf-dob',      profile.date_of_birth   || '');
            setVal('pf-notes',    profile.additional_notes || '');
        }

        if (user.role === 'provider_admin') {
            const el = document.getElementById('provider-fields');
            if (el) el.style.display = '';
            setVal('pf-company',       profile.company_name    || '');
            setVal('pf-office-phone',  profile.office_phone    || '');
            setVal('pf-prov-whatsapp', profile.whatsapp_number || '');
            setVal('pf-office-addr',   profile.office_address  || '');
        }
    }

    document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
        if (!currentUser) return;

        const btn     = document.getElementById('btn-save-profile');
        const spinner = document.getElementById('profile-spinner');
        const label   = document.getElementById('save-label');
        const success = document.getElementById('profile-success');
        const error   = document.getElementById('profile-error');

        success.style.display = 'none';
        error.style.display   = 'none';

        btn.disabled           = true;
        spinner.style.display  = 'block';
        label.textContent      = 'Saving…';

        try {
            // Update basic info (name)
            await AuthAPI.updateMe({
                first_name: document.getElementById('pf-first')?.value?.trim(),
                last_name:  document.getElementById('pf-last')?.value?.trim(),
            });

            // Update role profile
            const profilePayload = { phone: document.getElementById('pf-phone')?.value?.trim() };

            if (currentUser.role === 'client') {
                profilePayload.whatsapp_number  = document.getElementById('pf-whatsapp')?.value?.trim();
                profilePayload.date_of_birth    = document.getElementById('pf-dob')?.value || null;
                profilePayload.additional_notes = document.getElementById('pf-notes')?.value?.trim();
            }

            if (currentUser.role === 'provider_admin') {
                profilePayload.company_name    = document.getElementById('pf-company')?.value?.trim();
                profilePayload.office_phone    = document.getElementById('pf-office-phone')?.value?.trim();
                profilePayload.whatsapp_number = document.getElementById('pf-prov-whatsapp')?.value?.trim();
                profilePayload.office_address  = document.getElementById('pf-office-addr')?.value?.trim();
            }

            await AuthAPI.updateProfile(profilePayload);

            // Refresh local user
            currentUser = await AuthAPI.me();
            populateSidebar(currentUser);
            populateOverview(currentUser);

            success.style.display = 'block';
            success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (err) {
            const msg = err?.data?.detail
                || Object.values(err?.data ?? {}).flat()[0]
                || 'Could not save changes. Please try again.';
            error.textContent    = msg;
            error.style.display  = 'block';
        } finally {
            btn.disabled          = false;
            spinner.style.display = 'none';
            label.textContent     = 'Save Changes';
        }
    });

    // ── Password eye toggles ──────────────────────────────────────────────────
    document.querySelectorAll('.pw-eye').forEach(btn => {
        btn.addEventListener('click', function () {
            const input = document.getElementById(this.dataset.target);
            if (!input) return;
            const hidden = input.type === 'password';
            input.type = hidden ? 'text' : 'password';
            this.textContent = hidden ? '🙈' : '👁️';
        });
    });

    // ── Password strength ─────────────────────────────────────────────────────
    document.getElementById('pw-new')?.addEventListener('input', function () {
        const wrap  = document.getElementById('pw-strength-wrap');
        const fill  = document.getElementById('pw-fill');
        const label = document.getElementById('pw-label');
        const pw    = this.value;

        if (!pw) { if (wrap) wrap.style.display = 'none'; return; }
        if (wrap) wrap.style.display = 'block';

        let score = 0;
        if (pw.length >= 8)          score++;
        if (pw.length >= 12)         score++;
        if (/[A-Z]/.test(pw))        score++;
        if (/[0-9]/.test(pw))        score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        const levels = [
            { l: '',            c: '' },
            { l: 'Weak',        c: '#ef4444' },
            { l: 'Fair',        c: '#f59e0b' },
            { l: 'Good',        c: '#3b82f6' },
            { l: 'Strong',      c: '#22c55e' },
            { l: 'Very strong', c: '#22c55e' },
        ];
        if (fill)  { fill.style.width = `${(score / 5) * 100}%`; fill.style.background = levels[score].c; }
        if (label) { label.textContent = levels[score].l; label.style.color = levels[score].c; }
    });

    // ── Change password ───────────────────────────────────────────────────────
    document.getElementById('btn-change-pw')?.addEventListener('click', async () => {
        const btn     = document.getElementById('btn-change-pw');
        const spinner = document.getElementById('pw-spinner');
        const label   = document.getElementById('pw-btn-label');
        const success = document.getElementById('pw-success');
        const error   = document.getElementById('pw-error');

        const current = document.getElementById('pw-current')?.value;
        const newPw   = document.getElementById('pw-new')?.value;
        const confirm = document.getElementById('pw-confirm')?.value;

        success.style.display = 'none';
        error.style.display   = 'none';

        if (!current || !newPw || !confirm) {
            error.textContent   = 'Please fill in all password fields.';
            error.style.display = 'block';
            return;
        }

        if (newPw.length < 8) {
            error.textContent   = 'New password must be at least 8 characters.';
            error.style.display = 'block';
            return;
        }

        if (newPw !== confirm) {
            error.textContent   = 'New passwords do not match.';
            error.style.display = 'block';
            return;
        }

        btn.disabled          = true;
        spinner.style.display = 'block';
        label.textContent     = 'Updating…';

        try {
            await AuthAPI.changePassword(current, newPw);

            // Clear fields
            ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('pw-strength-wrap').style.display = 'none';

            success.style.display = 'block';
            success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (err) {
            const msg = err?.data?.current_password?.[0]
                || err?.data?.new_password?.[0]
                || err?.data?.detail
                || 'Password change failed. Please check your current password.';
            error.textContent   = msg;
            error.style.display = 'block';
        } finally {
            btn.disabled          = false;
            spinner.style.display = 'none';
            label.textContent     = 'Update Password';
        }
    });

    // ── Logout ────────────────────────────────────────────────────────────────
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        if (!confirm('Sign out of MediLink?')) return;
        await AuthAPI.logout();   // clears localStorage and redirects to /index.html
    });

    document.getElementById('btn-logout-all')?.addEventListener('click', async () => {
        if (!confirm('This will sign you out of all devices. Continue?')) return;
        await AuthAPI.logout();
    });

    // ── Utilities ─────────────────────────────────────────────────────────────
    function getInitials(user) {
        const f = (user.first_name || '').trim();
        const l = (user.last_name  || '').trim();
        if (f && l) return (f[0] + l[0]).toUpperCase();
        if (f)      return f[0].toUpperCase();
        return (user.email || '?')[0].toUpperCase();
    }

    function roleColor(role) {
        return {
            client:         '#E8272A',
            driver:         '#3b82f6',
            provider_admin: '#8b5cf6',
            staff:          '#f59e0b',
            admin:          '#ec4899',
        }[role] || '#E8272A';
    }

    function setEl(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setVal(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    init();

}());