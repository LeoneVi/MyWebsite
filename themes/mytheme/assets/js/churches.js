var lightbox = null;

async function initChurchGallery() {
    if (lightbox) {
        lightbox.destroy();
        lightbox = null;
    }

    if (!document.querySelector('.pswp-gallery')) return;

    var module = await import('https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe-lightbox.esm.js');
    if (!document.querySelector('.pswp-gallery')) return;

    lightbox = new module.default({
        gallery: '.pswp-gallery',
        children: 'a',
        pswpModule: function () {
            return import('https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.esm.js');
        }
    });
    lightbox.init();
}

initChurchGallery();
document.addEventListener('site:navigated', initChurchGallery);
