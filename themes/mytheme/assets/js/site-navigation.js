(function () {
    var activeRequest = null;

    function isPageLink(link, url) {
        if (!link || !link.href || link.target || link.hasAttribute('download')) return false;
        if (url.origin !== window.location.origin) return false;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

        var finalSegment = url.pathname.split('/').pop();
        return !finalSegment || !finalSegment.includes('.') || finalSegment.endsWith('.html');
    }

    function updateStyles(nextDocument) {
        var current = document.querySelector('link[data-site-styles]');
        var next = nextDocument.querySelector('link[data-site-styles]');

        if (!current || !next || current.href === next.href) return Promise.resolve();

        return new Promise(function (resolve) {
            var replacement = next.cloneNode(true);
            var finished = false;

            function finish(loaded) {
                if (finished) return;
                finished = true;
                if (loaded) current.remove();
                else replacement.remove();
                resolve();
            }

            replacement.addEventListener('load', function () { finish(true); }, { once: true });
            replacement.addEventListener('error', function () { finish(false); }, { once: true });
            current.after(replacement);
            window.setTimeout(function () { finish(false); }, 3000);
        });
    }

    function updatePageStyles(nextDocument) {
        var currentLinks = Array.from(document.querySelectorAll('link[data-page-style]'));
        var nextLinks = Array.from(nextDocument.querySelectorAll('link[data-page-style]'));
        var nextHrefs = new Set(nextLinks.map(function (link) { return link.getAttribute('href'); }));

        currentLinks.forEach(function (link) {
            if (!nextHrefs.has(link.getAttribute('href'))) link.remove();
        });

        return Promise.all(nextLinks.map(function (link) {
            var href = link.getAttribute('href');
            if (document.querySelector('link[data-page-style][href="' + href + '"]')) return Promise.resolve();

            return new Promise(function (resolve) {
                var replacement = link.cloneNode(true);
                replacement.addEventListener('load', resolve, { once: true });
                replacement.addEventListener('error', resolve, { once: true });
                document.head.appendChild(replacement);
            });
        }));
    }

    function updateMetadata(nextDocument) {
        var currentDescription = document.querySelector('meta[name="description"]');
        var nextDescription = nextDocument.querySelector('meta[name="description"]');
        if (currentDescription && nextDescription) currentDescription.content = nextDescription.content;
    }

    function scrollToTarget(url) {
        if (url.hash) {
            var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
            if (target) {
                target.scrollIntoView();
                return;
            }
        }
        window.scrollTo(0, 0);
    }

    async function navigate(destination, pushState) {
        var url = new URL(destination, window.location.href);

        if (activeRequest) activeRequest.abort();
        var request = new AbortController();
        activeRequest = request;
        document.documentElement.setAttribute('aria-busy', 'true');

        try {
            var response = await fetch(url.href, {
                headers: { 'X-Requested-With': 'site-navigation' },
                signal: request.signal
            });

            if (!response.ok) throw new Error('Page request failed: ' + response.status);

            var html = await response.text();
            var nextDocument = new DOMParser().parseFromString(html, 'text/html');
            var nextContent = nextDocument.querySelector('#site-content');
            var currentContent = document.querySelector('#site-content');

            if (!nextContent || !currentContent) throw new Error('Page content was not found');

            await Promise.all([updateStyles(nextDocument), updatePageStyles(nextDocument)]);

            var currentHeader = document.querySelector('.site-header');
            var nextHeader = nextDocument.querySelector('.site-header');
            if (currentHeader && nextHeader) {
                currentHeader.replaceWith(document.importNode(nextHeader, true));
            }

            currentContent.replaceWith(document.importNode(nextContent, true));
            document.title = nextDocument.title;
            document.body.className = nextDocument.body.className;
            document.documentElement.lang = nextDocument.documentElement.lang;
            updateMetadata(nextDocument);

            if (pushState) window.history.pushState({ siteNavigation: true }, '', url.href);

            scrollToTarget(url);
            document.dispatchEvent(new CustomEvent('site:navigated', { detail: { url: url.href } }));
        } catch (error) {
            if (error.name !== 'AbortError') window.location.assign(url.href);
        } finally {
            document.documentElement.removeAttribute('aria-busy');
            if (activeRequest === request) activeRequest = null;
        }
    }

    document.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        var link = event.target.closest('a[href]');
        if (!link) return;

        var url = new URL(link.href, window.location.href);
        if (!isPageLink(link, url)) return;

        event.preventDefault();
        navigate(url.href, true);
    });

    window.addEventListener('popstate', function () {
        navigate(window.location.href, false);
    });

    window.history.replaceState({ siteNavigation: true }, '', window.location.href);
})();
