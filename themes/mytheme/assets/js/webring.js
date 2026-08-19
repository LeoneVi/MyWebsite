(function () {
    var cachedData = null;

    function render(container, data) {
        container.innerHTML = '';

        if (data.prev) {
            var previous = document.createElement('a');
            previous.href = data.prev.url;
            previous.className = 'umaring-prev';
            previous.rel = 'noopener';
            previous.textContent = data.prev.name + ' ← ';
            container.appendChild(previous);
        }

        var label = document.createElement('span');
        label.className = 'umaring-label';
        label.textContent = ' UMass Ring ';
        container.appendChild(label);

        if (data.next) {
            var next = document.createElement('a');
            next.href = data.next.url;
            next.className = 'umaring-next';
            next.rel = 'noopener';
            next.textContent = ' → ' + data.next.name;
            container.appendChild(next);
        }
    }

    function initWebring() {
        var container = document.getElementById('umaring');
        if (!container) return;
        if (cachedData) {
            render(container, cachedData);
            return;
        }

        fetch('https://umaring.github.io/toryleone.json')
            .then(function (response) {
                if (!response.ok) throw new Error('umaring fetch failed: ' + response.status);
                return response.json();
            })
            .then(function (data) {
                cachedData = data;
                var currentContainer = document.getElementById('umaring');
                if (currentContainer) render(currentContainer, data);
            })
            .catch(function (error) {
                console.error('umaring widget failed to load:', error);
            });
    }

    initWebring();
    document.addEventListener('site:navigated', initWebring);
})();
