// src/pages/search/search.js
// Requires medilink-api.js to be loaded BEFORE this file (see search.html script order)

(function () {
    'use strict';

    const { AmbulancesAPI } = window.MediLink;

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const grid        = document.querySelector('.results-grid');
    const metaEl      = document.querySelector('.results-meta');
    const searchInput = document.querySelector('.search-box input');
    const searchBtn   = document.querySelector('.search-box .btn');

    // ── Backend type map (chip label → API value) ─────────────────────────────
    const CHIP_TYPE_MAP = {
        'Basic Life Support (BLS)':    'BLS',
        'Advanced Life Support (ALS)': 'ALS',
        'ICU-Equipped':                'ICU',
        'Maternity':                   'MAT',
        'Available Now':               '__available__',
        'All Types':                   '',
    };

    // ── Skeleton while loading ────────────────────────────────────────────────
    function showSkeleton() {
        if (!grid) return;
        grid.innerHTML = Array(6).fill(`
            <div class="provider-card" style="pointer-events:none;opacity:.45">
                <div style="height:160px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
                            background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:8px"></div>
            </div>`).join('');
    }

    // ── Render one card from API data ─────────────────────────────────────────
    function renderCard(a) {
        const available = a.status === 'available';
        return `
        <div class="provider-card" data-id="${a.id}" style="cursor:pointer">
            <div class="card-top">
                <div class="provider-icon">🚑</div>
                <div class="availability ${available ? 'available' : 'busy'}">
                    <span class="${available ? 'status-dot' : 'busy-dot'}"></span>
                    ${available ? 'Available' : (a.status_display ?? 'Busy')}
                </div>
            </div>
            <div class="provider-name">${a.provider.name}</div>
            <div class="provider-location">📍 ${a.provider.district ?? 'Uganda'}</div>
            <div class="card-tags">
                <span class="tag">${a.type_display}</span>
                ${a.provider.is_verified ? '<span class="tag">✓ Verified</span>' : ''}
                ${available ? '<span class="tag" style="background:#10b981;color:#fff;">Available</span>' : ''}
            </div>
            <div class="card-footer">
                <div>
                    <div class="price">UGX ${(Number(a.base_fare) / 1000).toFixed(0)}k</div>
                    <div class="price-label">Base fare</div>
                </div>
                <div class="rating">
                    <span class="stars">★</span> ${a.provider.rating ?? '—'}
                </div>
            </div>
        </div>`;
    }

    // ── Attach click handlers to live cards ───────────────────────────────────
    function attachCardClicks() {
        document.querySelectorAll('.provider-card[data-id]').forEach(card => {
            card.addEventListener('click', () => {
                window.location.href = `../booking/booking.html?ambulance=${card.dataset.id}`;
            });
        });
    }

    // ── Main load function ────────────────────────────────────────────────────
    async function loadAmbulances({ type = '', availableOnly = false } = {}) {
        showSkeleton();
        if (metaEl) metaEl.innerHTML = '<span>Loading providers…</span>';

        try {
            let items;

            if (availableOnly) {
                const res = await AmbulancesAPI.available(type ? { type } : {});
                items = res.results ?? res;
            } else {
                const filters = type ? { type } : {};
                const res     = await AmbulancesAPI.list(filters);
                items         = res.results ?? res;
            }

            // Client-side text filter (search box)
            const query = searchInput?.value?.trim().toLowerCase();
            if (query) {
                items = items.filter(a =>
                    a.provider.name.toLowerCase().includes(query) ||
                    (a.provider.district ?? '').toLowerCase().includes(query) ||
                    a.type_display.toLowerCase().includes(query)
                );
            }

            // Sort: available first, then by rating desc
            items.sort((a, b) => {
                if (a.status === 'available' && b.status !== 'available') return -1;
                if (b.status === 'available' && a.status !== 'available') return  1;
                return (Number(b.provider.rating) || 0) - (Number(a.provider.rating) || 0);
            });

            // Meta bar
            if (metaEl) metaEl.innerHTML =
                `<span>Showing <strong>${items.length}</strong> provider${items.length !== 1 ? 's' : ''}</span>
                 <span>Sorted by: Availability &amp; Rating</span>`;

            if (!grid) return;

            if (!items.length) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;padding:64px 24px;color:#6b7280">
                        <div style="font-size:48px;margin-bottom:16px">🔍</div>
                        <h3 style="margin-bottom:8px">No ambulances found</h3>
                        <p>Try removing a filter or broadening your search.<br>
                           For emergencies, call <strong>999</strong> immediately.</p>
                    </div>`;
                return;
            }

            grid.innerHTML = items.map(renderCard).join('');
            attachCardClicks();

        } catch (err) {
            console.warn('Search API error:', err);
            // Leave static fallback HTML intact — just update meta
            if (metaEl) metaEl.innerHTML =
                `<span style="color:#ef4444">⚠️ Could not load live data — showing cached results.</span>`;
            // Re-attach clicks to whatever static cards are present
            attachCardClicks();
        }
    }

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const label = this.textContent.trim();
            const type  = CHIP_TYPE_MAP[label] ?? '';
            loadAmbulances({
                type:          type === '__available__' ? '' : type,
                availableOnly: type === '__available__',
            });
        });
    });

    // Search box 
    searchBtn?.addEventListener('click', () => loadAmbulances());
    searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') loadAmbulances(); });

    // Boot 
    loadAmbulances();

}());