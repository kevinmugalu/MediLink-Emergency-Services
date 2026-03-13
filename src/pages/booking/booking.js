// src/pages/booking/booking.js
// Requires medilink-api.js to be loaded BEFORE this file (see booking.html script order)

(function () {
    'use strict';

    const { Auth, HospitalsAPI, AmbulancesAPI, BookingsAPI } = window.MediLink;

    // ── Auth guard ────────────────────────────────────────────────────────────
    if (!Auth.isLoggedIn()) {
        window.location.href =
            `../auth/login.html?next=${encodeURIComponent(window.location.href)}`;
    }

    // ── URL params ────────────────────────────────────────────────────────────
    const params       = new URLSearchParams(window.location.search);
    const preAmbulance = params.get('ambulance')      ?? null;
    const preEmergency = params.get('emergency_type') ?? '';   // e.g. "cardiac"

    // ── Typed DOM refs ────────────────────────────────────────────────────────
    // Form inputs (in DOM order — must match booking.html)
    const patientNameInput  = document.querySelectorAll('input.form-input')[0];  // Patient Name
    const patientPhoneInput = document.querySelectorAll('input.form-input')[1];  // Phone
    const pickupAddrInput   = document.querySelectorAll('input.form-input')[2];  // Pickup Location

    const emergencySel  = document.querySelectorAll('select.form-input')[0];     // Emergency Type
    const hospitalSel   = document.querySelectorAll('select.form-input')[1];     // Hospital
    const ambulanceSel  = document.querySelectorAll('select.form-input')[2];     // Ambulance

    const notesArea     = document.querySelector('textarea.form-input');
    const submitBtn     = document.querySelector('.btn-submit');

    // Summary panel
    const sumProviderName = document.querySelector('.summary-provider-name');
    const sumProviderType = document.querySelector('.summary-provider-type');
    const sumVals         = document.querySelectorAll('.summary-val');
    // sumVals[0] = Distance, [1] = Est. Arrival, [2] = Destination, [3] = Emergency Type, [4] = Base Fare
    const sumTotal        = document.querySelector('.total-val');

    // ── Emergency label → backend key map ────────────────────────────────────
    const EMERGENCY_MAP = {
        'Accident / Trauma': 'accident',
        'Cardiac Emergency': 'cardiac',
        'Maternity':         'maternity',
        'Respiratory':       'respiratory',
        'Stroke':            'stroke',
        'Paediatric':        'paediatric',
        'Other':             'other',
    };
    // Reverse: backend key → select option label
    const EMERGENCY_REVERSE = Object.fromEntries(
        Object.entries(EMERGENCY_MAP).map(([label, key]) => [key, label])
    );

    // ── Summary helpers ───────────────────────────────────────────────────────
    let ambulancesCache = [];

    function updateSummaryAmbulance(amb) {
        if (!amb) return;
        if (sumProviderName) sumProviderName.textContent = amb.provider.name;
        if (sumProviderType) sumProviderType.textContent =
            `${amb.type_display} · ${amb.provider.district ?? 'Uganda'}`;
        if (sumVals[4]) sumVals[4].textContent = `UGX ${Number(amb.base_fare).toLocaleString()}`;
        if (sumTotal)   sumTotal.textContent   = `UGX ${(Number(amb.base_fare) + 5000).toLocaleString()}`;
    }

    function updateSummaryHospital(hospital) {
        if (sumVals[2]) sumVals[2].textContent = hospital?.name ?? '—';
    }

    function updateSummaryEmergency() {
        if (!emergencySel || !sumVals[3]) return;
        const label = emergencySel.options[emergencySel.selectedIndex]?.text ?? '—';
        sumVals[3].textContent = label;
    }

    // ── Populate hospitals dropdown ───────────────────────────────────────────
    async function populateHospitals(emergencyKey = '') {
        if (!hospitalSel) return;
        hospitalSel.innerHTML = '<option value="">Loading hospitals…</option>';
        hospitalSel.disabled  = true;

        try {
            const res = emergencyKey
                ? await HospitalsAPI.forEmergency(emergencyKey)
                : await HospitalsAPI.list({ accepting: 'true' });
            const hospitals = res.results ?? res;

            hospitalSel.innerHTML =
                '<option value="">— Select a hospital (optional) —</option>' +
                hospitals.map(h =>
                    `<option value="${h.id}">
                        ${h.name} · ${h.available_beds} bed${h.available_beds !== 1 ? 's' : ''} · ${h.district ?? ''}
                    </option>`
                ).join('');

            hospitalSel.addEventListener('change', () => {
                const chosen = hospitals.find(h => h.id === hospitalSel.value);
                updateSummaryHospital(chosen ?? null);
            });
        } catch (_) {
            hospitalSel.innerHTML = '<option value="">Could not load hospitals — type in notes</option>';
        } finally {
            hospitalSel.disabled = false;
        }
    }

    // ── Populate ambulances dropdown ──────────────────────────────────────────
    async function populateAmbulances() {
        if (!ambulanceSel) return;
        ambulanceSel.innerHTML = '<option value="">Loading ambulances…</option>';
        ambulanceSel.disabled  = true;

        try {
            const res       = await AmbulancesAPI.available();
            ambulancesCache = res.results ?? res;

            if (!ambulancesCache.length) {
                ambulanceSel.innerHTML = '<option value="">No ambulances available right now</option>';
                return;
            }

            ambulanceSel.innerHTML = ambulancesCache.map(a =>
                `<option value="${a.id}" ${a.id === preAmbulance ? 'selected' : ''}>
                    ${a.provider.name} — ${a.type_display} (UGX ${(Number(a.base_fare) / 1000).toFixed(0)}k)
                </option>`
            ).join('');

            ambulanceSel.addEventListener('change', () => {
                const chosen = ambulancesCache.find(a => a.id === ambulanceSel.value);
                if (chosen) updateSummaryAmbulance(chosen);
            });

            const initial = ambulancesCache.find(a => a.id === preAmbulance) ?? ambulancesCache[0];
            if (initial) updateSummaryAmbulance(initial);

        } catch (_) {
            ambulanceSel.innerHTML = '<option value="">Could not load ambulances</option>';
        } finally {
            ambulanceSel.disabled = false;
        }
    }

    // ── Sync emergency dropdown → hospital list + summary ────────────────────
    if (emergencySel) {
        emergencySel.addEventListener('change', () => {
            updateSummaryEmergency();
            const backendKey = EMERGENCY_MAP[emergencySel.value] ?? '';
            populateHospitals(backendKey);
        });

        // Pre-select if emergency type was passed in URL
        if (preEmergency) {
            const matchLabel = EMERGENCY_REVERSE[preEmergency];
            if (matchLabel) {
                [...emergencySel.options].forEach(opt => {
                    opt.selected = opt.text === matchLabel;
                });
            }
        }
    }

    // ── Field-level validation ────────────────────────────────────────────────
    function setFieldError(input, message) {
        clearFieldError(input);
        const hint = document.createElement('span');
        hint.className  = 'field-error';
        hint.style.cssText = 'color:#ef4444;font-size:12px;display:block;margin-top:4px';
        hint.textContent   = message;
        input.style.borderColor = '#ef4444';
        input.parentNode.appendChild(hint);
    }

    function clearFieldError(input) {
        input.style.borderColor = '';
        const old = input.parentNode.querySelector('.field-error');
        if (old) old.remove();
    }

    function clearAllErrors() {
        document.querySelectorAll('.field-error').forEach(e => e.remove());
        document.querySelectorAll('input.form-input, select.form-input, textarea.form-input')
            .forEach(el => { el.style.borderColor = ''; });
        const errBox = document.querySelector('.booking-error');
        if (errBox) errBox.style.display = 'none';
    }

    function validate() {
        clearAllErrors();
        let ok = true;
        if (!patientNameInput?.value?.trim()) {
            setFieldError(patientNameInput, 'Patient name is required.');
            ok = false;
        }
        if (!patientPhoneInput?.value?.trim()) {
            setFieldError(patientPhoneInput, 'Phone number is required.');
            ok = false;
        } else if (!/^\+?\d[\d\s]{8,14}$/.test(patientPhoneInput.value.trim())) {
            setFieldError(patientPhoneInput, 'Enter a valid phone number — e.g. +256 700 123456');
            ok = false;
        }
        if (!pickupAddrInput?.value?.trim()) {
            setFieldError(pickupAddrInput, 'Pickup location is required.');
            ok = false;
        }
        return ok;
    }

    // ── Show booking-level error banner ───────────────────────────────────────
    function showBookingError(message) {
        let box = document.querySelector('.booking-error');
        if (!box) {
            box = document.createElement('div');
            box.className  = 'booking-error';
            box.style.cssText =
                'background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;'
                + 'padding:14px 18px;border-radius:10px;margin-bottom:16px;'
                + 'font-size:14px;line-height:1.5;white-space:pre-wrap;';
            submitBtn?.parentNode?.insertBefore(box, submitBtn);
        }
        box.textContent = `⚠️ ${message}`;
        box.style.display = 'block';
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!validate()) return;

            const emergencyLabel = emergencySel?.value ?? 'Other';
            const hospitalId     = hospitalSel?.value  || null;

            submitBtn.textContent = '⏳ Dispatching…';
            submitBtn.disabled    = true;
            clearAllErrors();

            try {
                const booking = await BookingsAPI.create({
                    patient_name:   patientNameInput.value.trim(),
                    patient_phone:  patientPhoneInput.value.trim(),
                    emergency_type: EMERGENCY_MAP[emergencyLabel] ?? 'other',
                    pickup_address: pickupAddrInput.value.trim(),
                    hospital:       hospitalId,
                    notes:          notesArea?.value?.trim() ?? '',
                    payment_method: 'cash',
                });

                // Persist for tracking page
                localStorage.setItem('ml_booking_ref', booking.reference);
                localStorage.setItem('ml_booking_id',  booking.id);

                window.location.href =
                    `../tracking/tracking.html?ref=${booking.reference}&id=${booking.id}`;

            } catch (err) {
                submitBtn.textContent = '🚑 Confirm & Dispatch Ambulance';
                submitBtn.disabled    = false;

                const d   = err?.data ?? {};
                const msg = d.detail
                    ?? d.hospital?.[0]
                    ?? d.patient_name?.[0]
                    ?? d.patient_phone?.[0]
                    ?? d.pickup_address?.[0]
                    ?? Object.values(d).flat()[0]
                    ?? 'Booking failed. Please try again or call 999.';

                showBookingError(msg);
            }
        });
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    (async function init() {
        const emergencyKey = preEmergency
            || (emergencySel ? EMERGENCY_MAP[emergencySel.value] ?? '' : '');

        await Promise.all([
            populateHospitals(emergencyKey),
            populateAmbulances(),
        ]);

        updateSummaryEmergency();
    }());

}());