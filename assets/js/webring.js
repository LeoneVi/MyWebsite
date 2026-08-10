(function () {
    var container = document.getElementById('umaring');
    if (!container) return;

    fetch('https://umaring.github.io/toryleone.json')
        .then(function (res) {
            if (!res.ok) throw new Error('umaring fetch failed: ' + res.status);
            return res.json();
        })
        .then(function (data) {
            var html = '';

            if (data.prev) {
                html += '<a href="' + data.prev.url + '" class="umaring-prev" rel="noopener">' + data.prev.name + ' <- </a>';
            }

            html += '<span class="umaring-label"> UMass Ring </span>';

            if (data.next) {
                html += '<a href="' + data.next.url + '" class="umaring-next" rel="noopener">' + '-> ' + data.next.name + '</a>';
            }

            container.innerHTML = html;
        })
        .catch(function (err) {
            console.error('umaring widget failed to load:', err);
        });
})();