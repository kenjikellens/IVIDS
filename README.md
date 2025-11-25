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

### 📚 **Detailed Page Guides**

For a comprehensive breakdown of every page, its structure, and functionality, please refer to the following guides:

-   **[📖 Full Page Guide](PAGES_GUIDE.md)**: Detailed explanation of Home, Movies, Series, Search, Details, Player, and Playlists.
-   **[⚙️ Settings Guide](SETTINGS_README.md)**: In-depth documentation of the Settings system, including language and theming options.

### Quick Overview

-   **🏠 Home**: Landing page with trending content and curated rows.
-   **🎬 Movies**: Dedicated section for film enthusiasts.
-   **📺 Series**: Dedicated section for TV show lovers.
-   **🔍 Search**: Find content with advanced filters.
-   **📄 Details**: Info, ratings, seasons, and playback options.
-   **⏯️ Player**: Full-screen video playback interface.
-   **💾 Playlists**: Manage personal collections.
-   **⚙️ Settings**: Customize language and appearance.

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
