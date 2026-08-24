(function () {
    function getStatusLabels() {
        var labels = {};
        document.querySelectorAll('[data-status-label]').forEach(function (item) {
            labels[item.dataset.statusLabel] = item.dataset.label;
        });
        return labels;
    }

    function updateRegion(regionElement, region, statusLabels, readout, defaultReadout) {
        var statusLabel = statusLabels[region.status] || region.status;
        var label = region.name + ': ' + statusLabel;
        var title = regionElement.querySelector('title');

        regionElement.dataset.status = region.status;
        regionElement.setAttribute('aria-label', label);
        if (title) title.textContent = label;

        function showRegion() {
            readout.textContent = region.name + ' · ' + statusLabel;
        }

        function resetReadout() {
            readout.textContent = defaultReadout;
        }

        regionElement.addEventListener('mouseenter', showRegion);
        regionElement.addEventListener('focus', showRegion);
        regionElement.addEventListener('mouseleave', resetReadout);
        regionElement.addEventListener('blur', resetReadout);
    }

    function slugify(value) {
        return value
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function hydrateMap(mapObject) {
        var card = mapObject.closest('[data-travel-card]');
        var mapDocument;
        if (!card) return;

        try {
            mapDocument = mapObject.contentDocument;
        } catch (error) {
            return;
        }
        if (!mapDocument || mapDocument.documentElement.dataset.travelHydrated === 'true') return;

        var dataElement = card.querySelector('.travel-map-data');
        var readout = card.querySelector('[data-map-readout]');
        if (!dataElement || !readout) return;

        var regions;
        try {
            regions = JSON.parse(dataElement.textContent);
        } catch (error) {
            return;
        }

        var regionsById = {};
        Object.keys(regions).forEach(function (name) {
            regionsById[slugify(name)] = { name: name, status: regions[name] };
        });

        var statusLabels = getStatusLabels();
        var defaultReadout = readout.textContent;
        mapDocument.querySelectorAll('[data-region]').forEach(function (regionElement) {
            var region = regionsById[regionElement.dataset.region];
            if (region) updateRegion(regionElement, region, statusLabels, readout, defaultReadout);
        });
        mapDocument.documentElement.dataset.travelHydrated = 'true';
    }

    function initTravelMaps() {
        document.querySelectorAll('[data-travel-map]').forEach(function (mapObject) {
            if (mapObject.dataset.travelBound !== 'true') {
                mapObject.addEventListener('load', function () { hydrateMap(mapObject); });
                mapObject.dataset.travelBound = 'true';
            }
            hydrateMap(mapObject);
        });
    }

    initTravelMaps();
    document.addEventListener('site:navigated', initTravelMaps);
})();
