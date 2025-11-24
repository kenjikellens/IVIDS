import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';

export async function init() {
    const [
        popular, actionAdventure, animation, crime, documentary, drama, family, kids, mystery, reality, scifiFantasy, soap, warPolitics, western, anime
    ] = await Promise.all([
        Api.fetchPopularTV(),
        Api.fetchActionAdventureSeries(),
        Api.fetchAnimationSeries(),
        Api.fetchCrimeSeries(),
        Api.fetchDocumentarySeries(),
        Api.fetchDramaSeries(),
        Api.fetchFamilySeries(),
        Api.fetchKidsSeries(),
        Api.fetchMysterySeries(),
        Api.fetchRealitySeries(),
        Api.fetchSciFiFantasySeries(),
        Api.fetchSoapSeries(),
        Api.fetchWarPoliticsSeries(),
        Api.fetchWesternSeries(),
        Api.fetchAnimeSeries()
    ]);

    if (popular && popular.length > 0) {
        new HeroSlider(popular.slice(0, 5), {
            containerId: 'hero-series',
            titleId: 'hero-title-series',
            descId: 'hero-desc-series',
            playBtnId: 'hero-play-series',
            detailsBtnId: 'hero-details-series'
        });
        setupRow('popular-series-row', popular.slice(5));
    }

    if (actionAdventure) setupRow('action-adventure-series-row', actionAdventure);
    if (animation) setupRow('animation-series-row', animation);
    if (crime) setupRow('crime-series-row', crime);
    if (documentary) setupRow('documentary-series-row', documentary);
    if (drama) setupRow('drama-series-row', drama);
    if (family) setupRow('family-series-row', family);
    if (kids) setupRow('kids-series-row', kids);
    if (mystery) setupRow('mystery-series-row', mystery);
    if (reality) setupRow('reality-series-row', reality);
    if (scifiFantasy) setupRow('scifi-fantasy-series-row', scifiFantasy);
    if (soap) setupRow('soap-series-row', soap);
    if (warPolitics) setupRow('war-politics-series-row', warPolitics);
    if (western) setupRow('western-series-row', western);
    if (anime) setupRow('anime-series-row', anime);
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

        img.onclick = () => Router.loadPage('details', { id: item.id, type: 'tv' });

        rowPosters.appendChild(img);
    });
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}