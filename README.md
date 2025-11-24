# IVIDS

IVIDS is a premium web application inspired by modern streaming platforms that lets you browse, search, and stream movies and TV series using third-party APIs.
It features a customizable UI with language and accent color settings, and a modern, responsive design.

## Features

- **Extensive Library**: Browse trending, top-rated, and genre-specific content including Disney, Marvel, Pixar, Studio Ghibli, and more.
- **Smart Search**: Search for movies and series (adult content hidden by default unless explicitly searched).
- **Streaming**: Stream content via embedded player.
- **Personalization**: Customizable accent color, language selection, and light/dark mode.
- **Playlists**: Create and manage custom playlists.
- **Resume Watching**: Automatically tracks your progress and lets you resume from where you left off.
- **Responsive Design**: Optimized for various screen sizes.

## Overview of Pages

Here is what you can find in the application:

### 🏠 **Home**
The landing page featuring a dynamic hero slider and curated rows of content:
- **Trending & Popular**: See what's hot right now.
- **New Releases**: Fresh content from 2025.
- **Studios**: Dedicated rows for Disney, Marvel, Pixar, Studio Ghibli, and Netflix Originals.
- **Regional**: Bollywood, Korean Content, and Anime.
- **Genres**: Horror, Sci-Fi, Thriller, Romance, and more.

### 🎬 **Movies**
A dedicated section for film enthusiasts:
- Browse movies by specific genres (Action, Comedy, Drama, etc.).
- Filter by Top Rated or Popularity.

### 📺 **Series**
A dedicated section for TV show bingers:
- Browse TV shows by genre (Animation, Crime, Reality, Soap, etc.).
- Find new series to watch.

### 🔍 **Search**
Find exactly what you're looking for:
- Search by title for movies and TV shows.
- **Note**: This is the only place where 18+ content can be found (if explicitly searched).

### 📄 **Details**
Comprehensive information about any title:
- **Overview**: Plot summary, release year, and genres.
- **Ratings**: Content rating (e.g., PG-13, R, TV-MA) displayed with specific styling.
- **Seasons & Episodes**: For TV shows, browse and select specific episodes.
- **Actions**: Play, Add to Playlist, or Resume watching.

### ⏯️ **Player**
The video playback interface:
- Stream the selected movie or episode.
- Supports full-screen viewing.

### 💾 **Playlists**
Manage your personal collections:
- Create new playlists (e.g., "Weekend Watch", "Favorites").
- Add or remove items from your playlists.

### ⚙️ **Settings**
Customize your experience:
- **Language**: Change the interface language (English, Spanish, French, German, etc.).
- **Appearance**: Toggle Light/Dark mode and choose a custom accent color.
- **Reset**: Clear local storage or reset settings to default.

## Getting Started

1. **Clone the repository:**
   ```sh
   git clone https://github.com/kenjikellens/ivids.git
   cd ivids
   ```

2. **Set up your TMDb API key:**
   - Register at [TMDb](https://www.themoviedb.org/documentation/api) for a free API key.
   - Replace the placeholder in `main/logic/api.js`:
     ```js
     const API_KEY = 'YOUR_TMDB_API_KEY';
     ```

3. **Open `main/gui/index.html` in your browser.**

## Project Structure

- `main/gui/` — UI pages (HTML, JS, CSS)
- `main/logic/` — API interaction and core logic
- `css/` — Global styles

## Legal Notice

This project is for educational purposes only.
It does **not** host or distribute any video content.
All movie and series data is provided by third-party APIs (e.g., TMDb, vidsrc.to) and is subject to their terms of service.
You are responsible for ensuring your use of this app complies with all applicable laws and third-party terms.

## License

This project is licensed under the [MIT License](LICENSE).

---

*IVIDS is not affiliated with Netflix, TMDb, or vidsrc.to.*
