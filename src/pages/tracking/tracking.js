// src/pages/tracking/tracking.js
// Requires medilink-api.js to be loaded BEFORE this file (see tracking.html script order)

(function () {
    'use strict';

    const { Auth, BookingsAPI } = window.MediLink;

    // ── State ────────────────────────────────────────────────────────────────
    let currentBooking = null;
    let pollTimer      = null;
    let etaTimer       = null;
    let etaSeconds     = 4 * 60; // optimistic default; counts down between polls

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const etaEl          = document.querySelector('.eta-time');
    const trackingIdEl   = document.querySelector('.tracking-id');
    const trackingNameEl = document.querySelector('.tracking-name');
    const driverAvatar   = document.querySelector('.driver-avatar');
    const driverNameEl   = document.querySelector('.driver-name');
    const driverPlateEl  = document.querySelector('.driver-plate');
    const hospitalOverlay= document.querySelector('.h-name');
    const progressDots   = document.querySelectorAll('.p-dot');
    const cancelBtn      = document.querySelector('.icon-btn:last-child');
    const callBtn        = document.querySelector('.icon-btn.call');

    // ── Status → progress step (0-indexed, matches 5 .p-dot elements) ────────
    const STATUS_STEP = {
        pending:    0,
        confirmed:  0,
        dispatched: 1,
        ongoing:    2,
        arrived:    3,
        completed:  4,
        cancelled: -1,
    };

    // ── Progress UI ───────────────────────────────────────────────────────────
    function updateProgress(status) {
        const activeIdx = STATUS_STEP[status] ?? 0;
        progressDots.forEach((dot, i) => {
            dot.className = 'p-dot'; // reset
            if (i < activeIdx) {
                dot.classList.add('done');
                dot.textContent = '✓';
            } else if (i === activeIdx) {
                dot.classList.add('active');
                dot.textContent = status === 'ongoing' ? '🚑' : String(i + 1);
            } else {
                dot.classList.add('pending');
                dot.textContent = String(i + 1);
            }
        });
    }

    // ── ETA display ───────────────────────────────────────────────────────────
    function formatEta(secs) {
        const m = Math.ceil(secs / 60);
        return m > 0 ? `${m} min` : 'Arriving';
    }

    function startEtaCountdown() {
        if (etaTimer) return;
        etaTimer = setInterval(() => {
            if (!currentBooking) return;
            if (!['dispatched', 'ongoing'].includes(currentBooking.status)) return;
            etaSeconds = Math.max(0, etaSeconds - 15);
            if (etaEl) etaEl.textContent = formatEta(etaSeconds);
            if (etaSeconds === 0) stopEtaCountdown();
        }, 15_000);
    }

    function stopEtaCountdown() {
        clearInterval(etaTimer);
        etaTimer = null;
    }

    // ── Render a booking response onto the page ───────────────────────────────
    function renderBooking(booking) {
        currentBooking = booking;

        // Booking reference + status
        if (trackingIdEl)
            trackingIdEl.textContent = `Booking #${booking.reference} · ${booking.status_display}`;

        // Ambulance / provider name
        const ambName = booking.ambulance?.provider?.name;
        const ambType = booking.ambulance
            ? `${booking.ambulance.type_display ?? ''} Ambulance`
            : '';
        if (trackingNameEl)
            trackingNameEl.textContent = ambName
                ? `${ambName} — ${ambType}`
                : 'Awaiting ambulance assignment…';

        // Driver
        const driverFull = booking.ambulance?.driver?.full_name ?? null;
        if (driverNameEl)
            driverNameEl.textContent = driverFull
                ? `${driverFull} — Paramedic`
                : 'Awaiting driver assignment';
        if (driverAvatar) {
            if (driverFull) {
                const parts = driverFull.trim().split(' ').filter(Boolean);
                driverAvatar.textContent = parts.length >= 2
                    ? parts[0][0] + parts[1][0]
                    : driverFull.slice(0, 2).toUpperCase();
            } else {
                driverAvatar.textContent = '—';
            }
        }
        if (driverPlateEl)
            driverPlateEl.textContent = booking.ambulance?.plate_number
                ? `${booking.ambulance.plate_number} · ${booking.ambulance.vehicle_make ?? ''} ${booking.ambulance.vehicle_model ?? ''}`.trim()
                : 'Plate not yet assigned';

        // Hospital overlay
        if (hospitalOverlay)
            hospitalOverlay.textContent = `🏥 ${booking.hospital?.name ?? 'Hospital not yet assigned'}`;

        // Also update the 5th step's <span> (transport destination)
        const stepSpans = document.querySelectorAll('.p-info span');
        if (stepSpans[4])
            stepSpans[4].textContent = booking.hospital?.name ?? 'Hospital TBD';

        // Call button — use real driver phone when available
        if (callBtn) {
            const phone = booking.ambulance?.driver?.phone ?? '999';
            callBtn.onclick = () => { window.location.href = `tel:${phone}`; };
        }

        // ETA
        if (etaEl) {
            if (['dispatched', 'ongoing'].includes(booking.status)) {
                etaEl.textContent = formatEta(etaSeconds);
                startEtaCountdown();
            } else if (['arrived', 'completed'].includes(booking.status)) {
                etaEl.textContent = 'Arrived';
                stopEtaCountdown();
            } else {
                etaEl.textContent = '—';
            }
        }

        // Progress steps
        updateProgress(booking.status);

        // Terminal states — stop polling
        if (booking.status === 'cancelled') {
            stopAll();
            alert('This booking has been cancelled.');
            window.location.href = '../../../index.html';
        }
        if (booking.status === 'completed') {
            stopAll();
        }
    }

    // ── Polling ───────────────────────────────────────────────────────────────
    async function fetchAndRender(id, ref) {
        try {
            const booking = id
                ? await BookingsAPI.get(id)
                : await BookingsAPI.track(ref);
            if (booking) renderBooking(booking);
        } catch (_) { /* silent — stale UI is acceptable for one cycle */ }
    }

    function startPolling(id, ref) {
        fetchAndRender(id, ref);                              // immediate
        pollTimer = setInterval(() => fetchAndRender(id, ref), 10_000);
    }

    function stopAll() {
        clearInterval(pollTimer);
        stopEtaCountdown();
        pollTimer = null;
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            if (!currentBooking) return;
            if (!Auth.isLoggedIn()) {
                window.location.href = `../auth/login.html?next=${encodeURIComponent(location.href)}`;
                return;
            }
            if (!confirm('Are you sure you want to cancel this booking?')) return;

            cancelBtn.textContent = '⏳';
            cancelBtn.disabled    = true;

            try {
                await BookingsAPI.cancel(currentBooking.id, 'Cancelled by patient via tracking page.');
                stopAll();
                alert('Booking cancelled successfully.');
                window.location.href = '../../../index.html';
            } catch (err) {
                const msg = err?.data?.detail ?? 'Could not cancel. Please call 999.';
                alert(msg);
                cancelBtn.textContent = '❌ Cancel';
                cancelBtn.disabled    = false;
            }
        });
    }

    // ── Reference lookup form (shown when no booking in URL) ─────────────────
    function setupLookupForm() {
        const lookupForm = document.querySelector('.lookup-form');
        const refInput   = document.getElementById('ref-input');
        const lookupBtn  = document.getElementById('ref-lookup-btn');
        if (!lookupForm) return;
        lookupForm.style.display = '';
        lookupBtn?.addEventListener('click', () => {
            const ref = refInput?.value?.trim();
            if (ref) window.location.href = `tracking.html?ref=${encodeURIComponent(ref)}`;
        });
        refInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') lookupBtn?.click();
        });
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id')  || localStorage.getItem('ml_booking_id')  || null;
    const ref    = params.get('ref') || localStorage.getItem('ml_booking_ref') || null;

    if (id || ref) {
        startPolling(id, ref);
    } else {
        setupLookupForm();
    }

}());