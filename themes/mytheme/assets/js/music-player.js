(function () {
    var storageKey = 'persistent-music-player';
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
    var isLeavingPage = false;
    var resumePending = false;
    var lastSavedSecond = -1;
    var playbackQueue = [];
    var queueIndex = -1;
    var queueMode = '';

    function readStoredState() {
        try {
            var stored = window.sessionStorage.getItem(storageKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            return null;
        }
    }

    function clearStoredState() {
        try {
            window.sessionStorage.removeItem(storageKey);
        } catch (error) {
            // The player still works when browser storage is unavailable.
        }
    }

    function saveState(playing) {
        if (!audio.src || player.hidden) {
            clearStoredState();
            return;
        }

        try {
            window.sessionStorage.setItem(storageKey, JSON.stringify({
                source: audio.currentSrc || audio.src,
                title: title.textContent,
                author: author.textContent,
                currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
                playing: typeof playing === 'boolean'
                    ? playing
                    : !audio.paused && !audio.ended
            }));
        } catch (error) {
            // The in-page player remains usable if storage is blocked or full.
        }
    }

    function sourceUrl(source) {
        return new URL(source, window.location.href).href;
    }

    function trackFromButton(button) {
        return {
            source: button.dataset.audio,
            title: button.dataset.title,
            author: button.dataset.author
        };
    }

    function pageTracks() {
        return Array.from(document.querySelectorAll('[data-song-play]')).map(trackFromButton);
    }

    function shuffledTracks(tracks) {
        var shuffled = tracks.slice();

        for (var index = shuffled.length - 1; index > 0; index -= 1) {
            var randomIndex = Math.floor(Math.random() * (index + 1));
            var current = shuffled[index];
            shuffled[index] = shuffled[randomIndex];
            shuffled[randomIndex] = current;
        }

        return shuffled;
    }

    function updateQueueButtons() {
        document.querySelectorAll('[data-piano-play-all], [data-piano-shuffle]').forEach(function (button) {
            var buttonMode = button.hasAttribute('data-piano-shuffle') ? 'shuffle' : 'all';
            var active = queueMode === buttonMode && queueIndex >= 0;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function clearQueue() {
        playbackQueue = [];
        queueIndex = -1;
        queueMode = '';
        updateQueueButtons();
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
        updateQueueButtons();
    }

    async function playTrack(track) {
        var nextSource = sourceUrl(track.source);

        if (audio.src === nextSource) {
            if (audio.paused) {
                try {
                    await audio.play();
                } catch (error) {
                    label.textContent = 'Ready to play';
                }
            }
            return;
        }

        title.textContent = track.title;
        author.textContent = track.author;
        label.textContent = 'Loading';
        player.hidden = false;
        audio.src = nextSource;
        audio.load();
        saveState(false);

        if ('mediaSession' in navigator && 'MediaMetadata' in window) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.author,
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

    async function playSong(button) {
        var nextSource = sourceUrl(button.dataset.audio);
        clearQueue();

        if (audio.src === nextSource) {
            if (audio.paused) await audio.play();
            else audio.pause();
            return;
        }

        await playTrack(trackFromButton(button));
    }

    async function startQueue(mode) {
        var tracks = pageTracks();
        if (!tracks.length) return;

        playbackQueue = mode === 'shuffle' ? shuffledTracks(tracks) : tracks;
        queueIndex = 0;
        queueMode = mode;
        updateQueueButtons();
        await playTrack(playbackQueue[queueIndex]);
    }

    async function playNextInQueue() {
        if (!playbackQueue.length || queueIndex < 0) return;

        queueIndex += 1;
        if (queueIndex >= playbackQueue.length) {
            clearQueue();
            saveState(false);
            return;
        }

        await playTrack(playbackQueue[queueIndex]);
    }

    document.addEventListener('click', function (event) {
        var playAllButton = event.target.closest('[data-piano-play-all]');
        if (playAllButton) {
            startQueue('all');
            return;
        }

        var shuffleButton = event.target.closest('[data-piano-shuffle]');
        if (shuffleButton) {
            startQueue('shuffle');
            return;
        }

        var songButton = event.target.closest('[data-song-play]');
        if (songButton) playSong(songButton);
    });

    toggle.addEventListener('click', function () {
        if (!audio.src) return;
        if (audio.paused) audio.play();
        else audio.pause();
    });

    close.addEventListener('click', function () {
        resumePending = false;
        clearQueue();
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        player.hidden = true;
        progress.value = 0;
        clearStoredState();
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

    audio.addEventListener('play', function () {
        resumePending = false;
        saveState(true);
    });

    audio.addEventListener('pause', function () {
        if (!isLeavingPage) saveState(false);
    });

    audio.addEventListener('ended', function () {
        if (playbackQueue.length && queueIndex >= 0) playNextInQueue();
        else saveState(false);
    });

    audio.addEventListener('timeupdate', function () {
        var currentSecond = Math.floor(audio.currentTime);
        if (currentSecond === lastSavedSecond) return;
        lastSavedSecond = currentSecond;
        saveState();
    });

    window.addEventListener('pagehide', function () {
        isLeavingPage = true;
        saveState(!audio.paused && !audio.ended);
    });

    document.addEventListener('site:navigated', function () {
        updateSongButtons();
        updateQueueButtons();
    });

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
        navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
        navigator.mediaSession.setActionHandler('seekto', function (details) {
            if (typeof details.seekTime === 'number') audio.currentTime = details.seekTime;
        });
    }

    function restorePlayer() {
        var state = readStoredState();
        if (!state || !state.source) return;

        title.textContent = state.title || 'Piano recording';
        author.textContent = state.author || 'Unknown artist';
        player.hidden = false;
        audio.src = state.source;
        audio.load();

        audio.addEventListener('loadedmetadata', function () {
            if (Number.isFinite(state.currentTime) && Number.isFinite(audio.duration)) {
                audio.currentTime = Math.min(state.currentTime, Math.max(0, audio.duration - 0.1));
            }

            updatePlayer();

            if (state.playing) {
                resumePending = true;
                audio.play().catch(function () {
                    label.textContent = 'Ready to resume';
                });
            }
        }, { once: true });
    }

    document.addEventListener('pointerdown', function (event) {
        if (!resumePending || !audio.paused || player.hidden) return;
        if (event.target.closest('[data-player-toggle], [data-player-close], [data-song-play], [data-player-progress]')) return;

        audio.play().catch(function () {
            label.textContent = 'Ready to resume';
        });
    }, true);

    restorePlayer();
})();
