# IVIDS

IVIDS is a web app inspired by Netflix that lets you browse, search, and stream movies and TV series using third-party APIs.  
It features a customizable UI with language and accent color settings, and a modern, responsive design.

## Features

- Browse trending, top-rated, action, comedy movies, and popular TV series
- Search for movies and series
- Stream content via embedded player (vidsrc.to)
- Customizable accent color and language selection
- Responsive, Netflix-like interface

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

- `main/gui/` — UI pages and main HTML
- `main/logic/` — API and data logic
- `css/` — Stylesheets
- `pages/settings.html` — Settings page

## Settings

- **Language:** Choose from English, Español, Français, Deutsch, Italiano, Português, Nederlands, 日本語
- **Accent Color:** Pick from presets or use a custom color

See [SETTINGS_README.md](SETTINGS_README.md) for full details.

## Legal Notice

This project is for educational purposes only.  
It does **not** host or distribute any video content.  
All movie and series data is provided by third-party APIs (e.g., TMDb, vidsrc.to) and is subject to their terms of service.  
You are responsible for ensuring your use of this app complies with all applicable laws and third-party terms.

## License

This project is licensed under the [MIT License](LICENSE).

---

*IVIDS is not affiliated with Netflix, TMDb, or vidsrc.to.*"# IVIDS" 
"# IVIDS" 
