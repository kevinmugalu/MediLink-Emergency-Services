// src/pages/dashboard/dashboard.js
// Highlight chart bar on hover
    document.querySelectorAll('.chart-bar').forEach(bar => {
        bar.addEventListener('mouseenter', function () {
            document.querySelectorAll('.chart-bar').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Row click → go to tracking
    document.querySelectorAll('tbody tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function () {
            window.location.href = '../tracking/tracking.html';
        });
    });