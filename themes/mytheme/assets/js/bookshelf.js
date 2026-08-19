(function () {
    function getMaxLength() {
        if (window.matchMedia('(max-width: 480px)').matches) return 65;
        if (window.matchMedia('(max-width: 768px)').matches) return 260;
        return 430;
    }

    function formatDate(dateStr) {
        if (/^\d{4}$/.test(dateStr)) return dateStr;

        if (/^\d{4}-\d{2}$/.test(dateStr)) {
            var monthParts = dateStr.split('-').map(Number);
            return new Date(monthParts[0], monthParts[1] - 1).toLocaleDateString('en-US', {
                timeZone: 'America/New_York', month: 'short', year: 'numeric'
            });
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            var dayParts = dateStr.split('-').map(Number);
            return new Date(dayParts[0], dayParts[1] - 1, dayParts[2]).toLocaleDateString('en-US', {
                timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric'
            });
        }

        return dateStr;
    }

    function initBookshelf() {
        var shelfList = document.getElementById('shelf-list');
        if (!shelfList) return;

        var rows = Array.from(document.querySelectorAll('.data-table tbody tr'));
        var counts = new Map([['read', rows.length]]);
        shelfList.innerHTML = '';

        document.querySelectorAll('.review-text').forEach(function (review) {
            var fullText = review.textContent.trim();
            var maxLength = getMaxLength();
            if (fullText.length <= maxLength) return;

            review.innerHTML = '<span class="collapsed"></span><span class="expanded" hidden></span>';
            var collapsed = review.querySelector('.collapsed');
            var expanded = review.querySelector('.expanded');
            collapsed.textContent = fullText.slice(0, maxLength);
            expanded.textContent = fullText;
            collapsed.insertAdjacentHTML('beforeend', ' <a href="#" class="review-toggle">...more</a>');
            expanded.insertAdjacentHTML('beforeend', ' <a href="#" class="review-toggle">(less)</a>');

            review.querySelectorAll('.review-toggle').forEach(function (link) {
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    collapsed.hidden = !collapsed.hidden;
                    expanded.hidden = !expanded.hidden;
                });
            });
        });

        document.querySelectorAll('.book-read').forEach(function (cell) {
            var dateStr = cell.textContent.trim();
            if (dateStr) cell.textContent = formatDate(dateStr);
        });

        rows.forEach(function (row) {
            (row.dataset.tags || '').split(',').map(function (tag) { return tag.trim(); }).filter(Boolean).forEach(function (tag) {
                counts.set(tag, (counts.get(tag) || 0) + 1);
            });
        });

        shelfList.insertAdjacentHTML('beforeend', '<li><a href="#" class="active" data-filter="read">read <span>(' + rows.length + ')</span></a></li>');
        Array.from(counts.entries()).filter(function (entry) { return entry[0] !== 'read'; }).sort(function (a, b) {
            return a[0].localeCompare(b[0]);
        }).forEach(function (entry) {
            shelfList.insertAdjacentHTML('beforeend', '<li><a href="#" data-filter="' + entry[0] + '">' + entry[0] + ' <span>(' + entry[1] + ')</span></a></li>');
        });

        shelfList.addEventListener('click', function (event) {
            var link = event.target.closest('[data-filter]');
            if (!link) return;
            event.preventDefault();

            shelfList.querySelectorAll('a').forEach(function (anchor) { anchor.classList.remove('active'); });
            link.classList.add('active');
            var filter = link.dataset.filter;

            rows.forEach(function (row) {
                var tags = (row.dataset.tags || '').split(',').map(function (tag) { return tag.trim(); });
                row.style.display = filter === 'read' || tags.includes(filter) ? '' : 'none';
            });
        });
    }

    initBookshelf();
    document.addEventListener('site:navigated', initBookshelf);
})();
