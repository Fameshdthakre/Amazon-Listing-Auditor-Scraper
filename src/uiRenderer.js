export const UIRenderer = {
    toggle(elementId, show) {
        const el = document.getElementById(elementId);
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    },

    setText(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text;
    },

    setHtml(elementId, html) {
        const el = document.getElementById(elementId);
        if (el) el.innerHTML = html;
    },

    updateDashboard(results) {
        let totalLqs = 0;
        let issueCount = 0;
        let mismatchCount = 0;

        results.forEach(item => {
            if (item.attributes && item.attributes.lqs) {
                const score = parseInt(item.attributes.lqs.split('/')[0]);
                if (!isNaN(score)) totalLqs += score;
                if (score < 70) issueCount++;
            }
            if (item.expected && item.attributes.metaTitle !== item.expected.title) mismatchCount++;
        });

        const avg = results.length ? Math.round(totalLqs / results.length) : 0;

        this.setText('statTotal', results.length);
        this.setText('statLqs', avg + '/100');
        this.setText('statIssues', mismatchCount > 0 ? `${mismatchCount} Diff` : issueCount);

        this.toggle('resultsPlaceholder', false);
        document.getElementById('dashboardView').style.display = 'grid'; // Grid is hard to toggle with generic hidden class if display:grid is needed
    },

    resetDashboard() {
        this.toggle('resultsPlaceholder', true);
        document.getElementById('dashboardView').style.display = 'none';
        this.setText('statTotal', '-');
        this.setText('statLqs', '-');
        this.setText('statIssues', '-');
    },

    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
             toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
             toggleBtn.title = theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode";
        }
    },

    updateProgress(processed, total, statusMsg, isScanning) {
        const container = document.getElementById('progressContainer');
        const bar = document.getElementById('progressBar');
        const countDiv = document.getElementById('progressCount');
        const statusDiv = document.getElementById('status');

        if (statusDiv) statusDiv.innerHTML = statusMsg;

        if (isScanning && total > 0) {
            container.style.display = 'block';
            const pct = Math.round((processed / total) * 100);
            bar.style.width = pct + '%';

            countDiv.style.display = 'block';
            countDiv.textContent = `Processed: ${processed} / ${total}`;
        } else {
            container.style.display = 'none';
            bar.style.width = '0%';
            countDiv.style.display = 'none';
        }
    }
};
