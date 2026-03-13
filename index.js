(function () {
    'use strict';

    const { AmbulancesAPI } = window.MediLink;

    // ── Smooth scroll for anchor links ────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ── Interactive steps ─────────────────────────────────────────────────────
    document.querySelectorAll('.step').forEach(step => {
        step.addEventListener('click', function () {
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Static ambulance list selection (pre-API fallback) ────────────────────
    document.querySelectorAll('.amb-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.amb-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Fade-in on scroll ─────────────────────────────────────────────────────
    const fadeEls = document.querySelectorAll('.fade-in');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        fadeEls.forEach(el => observer.observe(el));
    } else {
        // Fallback for older browsers
        fadeEls.forEach(el => el.classList.add('visible'));
    }

    // ── Ambulance Map Card — live data ────────────────────────────────────────
    async function initMapCard() {
        const list = document.querySelector('.ambulance-list');
        if (!list) return;

        // Show skeleton while loading
        list.innerHTML = Array(2).fill(`
            <div class="amb-item" style="pointer-events:none;opacity:.4">
                <div class="amb-avatar">🚑</div>
                <div class="amb-info">
                    <div style="height:12px;width:110px;background:#e5e7eb;border-radius:4px;margin-bottom:6px"></div>
                    <div style="height:10px;width:80px;background:#f3f4f6;border-radius:4px"></div>
                </div>
                <div style="text-align:right">
                    <div style="height:12px;width:40px;background:#e5e7eb;border-radius:4px;margin-bottom:6px;margin-left:auto"></div>
                    <div style="height:10px;width:30px;background:#f3f4f6;border-radius:4px;margin-left:auto"></div>
                </div>
            </div>`).join('');

        try {
            const res   = await AmbulancesAPI.available();
            const items = (res.results ?? res).slice(0, 3);

            if (!items.length) {
                list.innerHTML = `
                    <div class="amb-item" style="justify-content:center;color:#6b7280;font-size:13px">
                        No ambulances available right now
                    </div>`;
                return;
            }

            list.innerHTML = items.map((a, i) => `
                <div class="amb-item ${i === 0 ? 'active' : ''}"
                     data-id="${a.id}"
                     style="cursor:pointer"
                     onclick="window.location.href='./src/pages/booking/booking.html?ambulance=${a.id}'">
                    <div class="amb-avatar">🚑</div>
                    <div class="amb-info">
                        <div class="amb-name">${a.provider.name}</div>
                        <div class="amb-meta">${a.type_display} · ${a.provider.district ?? 'Uganda'}</div>
                    </div>
                    <div style="text-align:right">
                        <div class="amb-dist">UGX ${(Number(a.base_fare) / 1000).toFixed(0)}k</div>
                        <div style="font-size:11px;color:var(--text-muted);">${a.status_display ?? 'Available'}</div>
                    </div>
                </div>`).join('');

            // Re-attach selection highlight on freshly rendered items
            document.querySelectorAll('.amb-item[data-id]').forEach(item => {
                item.addEventListener('click', function () {
                    document.querySelectorAll('.amb-item').forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                });
            });

            // Animate the map dots to match live count
            animateMapDots(items.length);

        } catch (err) {
            console.warn('Could not load live ambulances for map card:', err);
            // Static HTML in index.html remains visible — do nothing
        }
    }

    // ── Animate floating ambulance emojis on the map card ────────────────────
    function animateMapDots(count) {
        const dots = document.querySelectorAll('.map-ambulance');
        dots.forEach((dot, i) => {
            if (i < count) {
                dot.style.opacity   = '1';
                dot.style.animation = `float ${2 + i * 0.4}s ease-in-out infinite alternate`;
            } else {
                dot.style.opacity = '0.15';
            }
        });
    }

    // ── Live provider count in hero badge ────────────────────────────────────
    async function updateProviderCount() {
        try {
            const res   = await AmbulancesAPI.list();
            const items = res.results ?? res;
            const badge = document.querySelector('.hero-badge');
            if (badge && items.length) {
                // Find the count span/text and update it
                badge.innerHTML =
                    `<span class="pulse"></span> Live in Uganda — ${items.length}+ Providers`;
            }
        } catch (_) {
            // Silently keep static value
        }
    }

    // ── Keyboard accessibility: Enter on nav links ────────────────────────────
    document.querySelectorAll('nav a').forEach(link => {
        link.setAttribute('tabindex', '0');
    });

    // ── Emergency bar close (optional UX improvement) ─────────────────────────
    const emergencyBar = document.querySelector('.emergency-bar');
    if (emergencyBar) {
        // Allow dismissing with Escape key
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') emergencyBar.style.display = 'none';
        });
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    initMapCard();
    updateProviderCount();

}());