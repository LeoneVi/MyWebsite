(function () {
    function openPortfolioItem(button) {
        var portfolio = button.closest('[data-portfolio]');
        if (!portfolio) return;

        var detail = portfolio.querySelector('[data-portfolio-detail]');
        if (!detail) return;

        var selectedCard = null;
        detail.querySelectorAll('[data-portfolio-card]').forEach(function (card) {
            var selected = card.dataset.portfolioCard === button.dataset.portfolioOpen;
            card.hidden = !selected;
            if (selected) selectedCard = card;
        });

        if (!selectedCard) return;
        detail.hidden = false;

        portfolio.querySelectorAll('[data-portfolio-open]').forEach(function (item) {
            var selected = item === button;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-expanded', selected ? 'true' : 'false');
        });

        selectedCard.focus({ preventScroll: true });

        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        detail.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start'
        });
    }

    document.addEventListener('click', function (event) {
        var button = event.target.closest('[data-portfolio-open]');
        if (button) openPortfolioItem(button);
    });
})();
