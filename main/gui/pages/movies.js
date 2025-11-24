import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';

export async function init() {
    const [
        popular, topRated, action, comedy,
        adventure, animation, crime, documentary, drama, family, fantasy, history, horror, music, mystery, romance, scifi, thriller, war, western, anime
    ] = await Promise.all([
        Api.fetchTrending(),
        Api.fetchTopRated(),
        Api.fetchActionMovies(),
        Api.fetchComedyMovies(),
        Api.fetchAdventureMovies(),
        Api.fetchAnimationMovies(),
        Api.fetchCrimeMovies(),
        Api.fetchDocumentaryMovies(),
        Api.fetchDramaMovies(),
        Api.fetchFamilyMovies(),
        Api.fetchFantasyMovies(),
        Api.fetchHistoryMovies(),
        Api.fetchHorrorMovies(),
        Api.fetchMusicMovies(),
        Api.fetchMysteryMovies(),
        Api.fetchRomanceMovies(),
        Api.fetchSciFiMovies(),
        Api.fetchThrillerMovies(),
        Api.fetchWarMovies(),
        Api.fetchWesternMovies(),
        Api.fetchAnimeMovies()
    ]);

    // Filter for movies only just in case
    const movies = popular.filter(m => m.media_type === 'movie' || !m.media_type);

    if (movies && movies.length > 0) {
        new HeroSlider(movies.slice(0, 5), {
            containerId: 'hero-movies',
            titleId: 'hero-title-movies',
            descId: 'hero-desc-movies',
            playBtnId: 'hero-play-movies',
            detailsBtnId: 'hero-details-movies'
        });
        setupRow('popular-movies-row', movies.slice(5));
    }
    if (topRated) setupRow('top-rated-movies-row', topRated);
    if (action) setupRow('action-movies-row', action);
    if (comedy) setupRow('comedy-movies-row', comedy);
    if (adventure) setupRow('adventure-movies-row', adventure);
    if (animation) setupRow('animation-movies-row', animation);
    if (crime) setupRow('crime-movies-row', crime);
    if (documentary) setupRow('documentary-movies-row', documentary);
    if (drama) setupRow('drama-movies-row', drama);
    if (family) setupRow('family-movies-row', family);
    if (fantasy) setupRow('fantasy-movies-row', fantasy);
    if (history) setupRow('history-movies-row', history);
    if (horror) setupRow('horror-movies-row', horror);
    if (music) setupRow('music-movies-row', music);
    if (mystery) setupRow('mystery-movies-row', mystery);
    if (romance) setupRow('romance-movies-row', romance);
    if (scifi) setupRow('scifi-movies-row', scifi);
    if (thriller) setupRow('thriller-movies-row', thriller);
    if (war) setupRow('war-movies-row', war);
    if (western) setupRow('western-movies-row', western);
    if (anime) setupRow('anime-movies-row', anime);
}

// Removed setupHero

function setupRow(elementId, items) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;
    rowPosters.innerHTML = '';

    // Create container if not already wrapped
    let container = rowPosters.parentElement;
    if (!container.classList.contains('row-container')) {
        container = document.createElement('div');
        container.className = 'row-container';
        rowPosters.parentNode.insertBefore(container, rowPosters);
        container.appendChild(rowPosters);
    }

    items.forEach(item => {
        if (!item.poster_path) return;

        const img = document.createElement('img');
        img.className = 'poster focusable';
        img.src = Api.getImageUrl(item.poster_path);
        img.alt = item.title || item.name;

        img.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });

        rowPosters.appendChild(img);
    });
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}