(function () {
    var player = document.querySelector('#persistent-music-player');
    if (!player) return;

    var audio = player.querySelector('[data-player-audio]');
    var toggle = player.querySelector('[data-player-toggle]');
    var icon = player.querySelector('[data-player-icon]');
    var title = player.querySelector('[data-player-title]');
    var author = player.querySelector('[data-player-author]');
    var label = player.querySelector('[data-player-label]');
    var progress = player.querySelector('[data-player-progress]');
    var time = player.querySelector('[data-player-time]');
    var close = player.querySelector('[data-player-close]');

    function sourceUrl(source) {
        return new URL(source, window.location.href).href;
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '0:00';
        var minutes = Math.floor(seconds / 60);
        var remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
        return minutes + ':' + remainder;
    }

    function isCurrent(button) {
        return audio.src && sourceUrl(button.dataset.audio) === audio.src;
    }

    function updateSongButtons() {
        document.querySelectorAll('[data-song-play]').forEach(function (button) {
            var playing = isCurrent(button) && !audio.paused;
            button.classList.toggle('is-playing', playing);
            button.querySelector('[data-song-icon]').textContent = playing ? 'Ⅱ' : '▶';
            button.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + button.dataset.title + ' by ' + button.dataset.author);
        });
    }

    function updatePlayer() {
        var playing = !audio.paused && !audio.ended;
        icon.textContent = playing ? 'Ⅱ' : '▶';
        toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        label.textContent = audio.error ? 'Unable to play' : (playing ? 'Now playing' : 'Paused');

        var duration = audio.duration;
        progress.value = Number.isFinite(duration) && duration > 0
            ? Math.round((audio.currentTime / duration) * 1000)
            : 0;
        time.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(duration);
        updateSongButtons();
    }

    async function playSong(button) {
        var nextSource = sourceUrl(button.dataset.audio);

        if (audio.src === nextSource) {
            if (audio.paused) await audio.play();
            else audio.pause();
            return;
        }

        title.textContent = button.dataset.title;
        author.textContent = button.dataset.author;
        label.textContent = 'Loading';
        player.hidden = false;
        audio.src = nextSource;
        audio.load();

        if ('mediaSession' in navigator && 'MediaMetadata' in window) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: button.dataset.title,
                artist: button.dataset.author,
                album: 'Tory\'s piano recordings'
            });
        }

        try {
            await audio.play();
        } catch (error) {
            label.textContent = 'Ready to play';
            updatePlayer();
        }
    }

    document.addEventListener('click', function (event) {
        var songButton = event.target.closest('[data-song-play]');
        if (songButton) playSong(songButton);
    });

    toggle.addEventListener('click', function () {
        if (!audio.src) return;
        if (audio.paused) audio.play();
        else audio.pause();
    });

    close.addEventListener('click', function () {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        player.hidden = true;
        progress.value = 0;
        updateSongButtons();
    });

    progress.addEventListener('input', function () {
        if (Number.isFinite(audio.duration)) {
            audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
        }
    });

    ['play', 'pause', 'ended', 'loadedmetadata', 'timeupdate', 'error'].forEach(function (eventName) {
        audio.addEventListener(eventName, updatePlayer);
    });

    document.addEventListener('site:navigated', updateSongButtons);

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
        navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
        navigator.mediaSession.setActionHandler('seekto', function (details) {
            if (typeof details.seekTime === 'number') audio.currentTime = details.seekTime;
        });
    }
})();
