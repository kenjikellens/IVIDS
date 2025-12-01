# IVIDS

IVIDS is a premium web application inspired by modern streaming platforms that lets you browse, search, and stream movies and TV series using third-party APIs.
It features a customizable UI with language and accent color settings, and a modern design.

## Features

- **Extensive Library**: Browse trending, top-rated, and genre-specific content including Disney, Marvel, Pixar, Studio Ghibli, and more.
- **Smart Search**: Search for movies and series (adult content hidden by default unless explicitly searched).
- **Streaming**: Stream content via embedded player.
- **Personalization**: Customizable accent color, language selection, and light/dark mode.
- **Playlists**: Create and manage custom playlists.
- **Resume Watching**: Automatically tracks your progress and lets you resume from where you left off.
- **Responsive Design**: Optimized for various screen sizes.

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

## Overview of Pages

-   **🏠 Home**: Landing page with trending content and curated rows.
-   **🎬 Movies**: Dedicated section for film enthusiasts.
-   **📺 Series**: Dedicated section for TV show lovers.
-   **🔍 Search**: Find content with advanced filters.
-   **📄 Details**: Info, ratings, seasons, and playback options.
-   **⏯️ Player**: Full-screen video playback interface.
-   **💾 Playlists**: Manage personal collections.
-   **⚙️ Settings**: Customize language and appearance.
-   *Languages:* English, Francais, Nederlands, Deutsch, Espagnõl.

## Detailed Page Guide

This section provides a detailed explanation of each page in the IVIDS application, including its structure, features, and functionality.

### 🏠 Home Page (`home.html`)

The **Home** page is the landing page of the application, designed to provide users with immediate access to trending and popular content.

#### **Structure**
1.  **Hero Section**:
    -   A large, dynamic banner at the top featuring a trending movie or show.
    -   Displays the title, description, and action buttons ("Play", "More Info").
    -   Includes a premium loading animation while content fetches.
2.  **Content Rows**:
    -   Horizontal scrollable lists of movie and TV show posters.
    -   Categories include:
        -   **Recently Watched**: Shows content the user has started but not finished.
        -   **Trending Now**: Currently popular content.
        -   **Highly Rated**: Content with high vote averages.
        -   **New This Year**: Releases from the current year.
        -   **Studios**: Specific rows for Disney, Marvel, Pixar, Studio Ghibli, and Netflix Originals.
        -   **Regional**: Korean Content, Bollywood.
        -   **Genres**: Horror, Sci-Fi, Thriller, Romance, Family, Documentary, Crime, Fantasy.

#### **Functionality**
-   **Navigation**: Users can navigate through the hero buttons and content rows using the keyboard or remote control (spatial navigation).
-   **Dynamic Loading**: Content is fetched from the TMDb API.
-   **Interactivity**: Clicking a poster navigates to the **Details** page for that item.

---

### 🎬 Movies Page (`movies.html`)

The **Movies** page is dedicated specifically to film content, allowing users to explore various genres.

#### **Structure**
1.  **Hero Section**:
    -   Similar to the Home page but features a popular *movie*.
2.  **Genre Rows**:
    -   **Popular Movies**: The most popular films right now.
    -   **Top Rated**: Critically acclaimed films.
    -   **Genres**: Action, Comedy, Adventure, Animation, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Sci-Fi, Thriller, War, Western.

#### **Functionality**
-   Focuses purely on movies, filtering out TV shows.
-   Provides a deep dive into specific film genres.

---

### 📺 Series Page (`series.html`)

The **Series** page is dedicated to TV shows and series.

#### **Structure**
1.  **Hero Section**:
    -   Features a popular *TV show*.
2.  **Genre Rows**:
    -   **Popular Series**: Trending TV shows.
    -   **Top Rated Series**: Highly rated shows.
    -   **Genres**: Action & Adventure, Animation, Crime, Documentary, Drama, Family, Kids, Mystery, Reality, Sci-Fi & Fantasy, Soap, War & Politics, Western.

#### **Functionality**
-   Focuses purely on TV content.
-   Includes specific genres relevant to TV (e.g., Soap, Reality, Kids).

---

### 🔍 Search Page (`search.html`)

The **Search** page allows users to find specific content and filter results based on their preferences.

#### **Structure**
1.  **Filters Sidebar** (Left):
    -   **Sort By**: Popularity, Top Rated, Newest, Most Voted.
    -   **Year**: Filter by release year.
    -   **Type**: Toggle between Movie and Series.
    -   **Genres**: Select specific genres.
    -   **Age Rating**: Filter by certification (e.g., PG, R).
2.  **Search Content** (Right):
    -   **Search Box**: Input field for typing queries.
    -   **Recent Searches**: Displays history of previous searches.
    -   **Search Results**: Grid of posters matching the query/filters.

#### **Functionality**
-   **Real-time Filtering**: Changing filters updates the results.
-   **Explicit Content**: This is the only area where 18+ content can be accessed if explicitly searched for.
-   **View Toggle**: Switch between grid and list views (if implemented).

---

### 📄 Details Page (`details.html`)

The **Details** page provides comprehensive information about a selected movie or TV show.

#### **Structure**
1.  **Top Section**:
    -   **Background**: Backdrop image of the content.
    -   **Info**: Title, Genres, Release Date, Content Rating.
    -   **Overview**: Plot summary.
    -   **Actions**:
        -   **Play**: Starts playback.
        -   **Add to Playlist**: Opens a modal to save the content.
        -   **Back**: Returns to the previous page.
2.  **Bottom Section**:
    -   **Seasons & Episodes** (TV Only):
        -   List of seasons.
        -   List of episodes for the selected season.
    -   **Recommendations**: "You Might Also Like" row.

#### **Functionality**
-   **Contextual Data**: Displays different info for Movies vs. TV Shows (e.g., seasons/episodes).
-   **Playlist Management**: Users can add the current title to their custom playlists.
-   **Resume**: If previously watched, the "Play" button might function as "Resume".

---

### ⏯️ Player Page (`player.html`)

The **Player** page is the interface for video playback.

#### **Structure**
1.  **Video Container**: Full-screen area for the video player (iframe or HTML5 video).
2.  **Controls**:
    -   **Play/Pause**: Toggle playback.
    -   **Stop**: Stop playback.
    -   **Back**: Return to the Details page.

#### **Functionality**
-   **Streaming**: Embeds the video source (e.g., via vidsrc.to or similar).
-   **Progress Tracking**: Saves watch progress to allow resuming later.

---

### 💾 Playlists Page (`playlists.html`)

The **Playlists** page allows users to manage their personal collections of content.

#### **Structure**
1.  **List View**:
    -   **Sidebar**: "Create Playlist" button.
    -   **Grid**: Displays all user-created playlists.
    -   **Empty State**: Prompt to create a playlist if none exist.
2.  **Details View**:
    -   **Header**: Playlist title, Back button, Delete button.
    -   **Items Grid**: Posters of movies/shows in the playlist.
3.  **Modals**:
    -   **Create Playlist**: Input for new playlist name.
    -   **Delete Playlist**: Confirmation dialog.

#### **Functionality**
-   **CRUD Operations**: Create, Read, Update (add/remove items), Delete playlists.
-   **Persistence**: Playlists are saved in `localStorage`.

---

### ⚙️ Settings Page (`settings.html`)

The **Settings** page allows users to customize the application.

*For a full detailed guide on the Settings system, please refer to the [Settings System](#settings-system) section.*

#### **Key Features**
-   **Language**: Change interface language.
-   **Accent Color**: Customize the primary theme color.
-   **Reset**: Clear data.

## Settings System

### Available Settings

The settings system currently supports two functional settings:

#### 1. Language
- **Type**: Dropdown selection
- **Storage Key**: `language`
- **Default**: `en` (English)
- **Options**: 
  - English (en)
  - Español (es)
  - Français (fr)
  - Deutsch (de)
  - Italiano (it)
  - Português (pt)
  - Nederlands (nl)
  - 日本語 (ja)

The language preference is saved to localStorage and applied to the `<html lang="">` attribute. Content translation would need to be implemented separately.

#### 2. Accent Color
- **Type**: Color picker with presets
- **Storage Key**: `accentColor`
- **Default**: `#46d369` (Green)
- **Preset Options**:
  - Green (Default): `#46d369`
  - Netflix Red: `#e50914`
  - Cyan: `#00d4ff`
  - Purple: `#9146ff`
  - Orange: `#ff6b35`
  - Gold: `#ffd700`
  - Pink: `#ff1744`
  - Neon Green: `#00e676`
  - Custom: Any color via color picker

The accent color is applied globally to the `--primary-color` CSS variable, which affects:
- Navigation active states
- Buttons and interactive elements
- Focus indicators
- Glow effects
- Icons and highlights

### How It Works

#### Storage
Settings are stored in `localStorage` under the key `ivids-settings` as a JSON object:
```json
{
  "language": "en",
  "accentColor": "#46d369"
}
```

#### Application Flow
1. User opens the app → `app.js` loads settings from localStorage
2. Settings are applied to CSS variables and HTML attributes
3. User changes settings → `settings.js` saves to localStorage and updates UI in real-time
4. Settings persist across sessions

#### Files Involved
- **`pages/settings.html`**: Settings UI page
- **`pages/settings.js`**: Settings logic and localStorage management
- **`js/app.js`**: Loads and applies settings on app startup
- **`css/style.css`**: Uses CSS variables for theming

### Usage

#### Getting Current Settings (JavaScript)
```javascript
// From settings page
const settings = window.settingsManager.getSettings();

// From any page
const settings = window.getIVIDSSettings();
// Returns: { language: 'en', accentColor: '#46d369' }
```

#### Applying Settings Programmatically
```javascript
// Change accent color
document.documentElement.style.setProperty('--primary-color', '#e50914');

// Save to localStorage
localStorage.setItem('ivids-settings', JSON.stringify({
  language: 'es',
  accentColor: '#e50914'
}));
```

### Future Enhancements

To fully implement these settings:

1. **Language System**:
   - Create translation files for each language
   - Implement i18n library or custom translation function
   - Update all UI text based on selected language

2. **Additional Color Variables**:
   - Add more CSS variables for fine-tuned theming
   - Support for dark/light mode toggle
   - Advanced color schemes (background, text, etc.)

### Testing

To test the settings:
1. Open the app at `index.html`
2. Click the settings icon in the top-right navbar
3. Change the language or accent color
4. You'll see a "Settings saved!" notification
5. Navigate back to the main app - changes are applied
6. Refresh the page - settings persist

## Legal Notice

This project is for educational purposes only.
It does **not** host or distribute any video content.
All movie and series data is provided by third-party APIs (e.g., TMDb, vidsrc.to) and is subject to their terms of service.
You are responsible for ensuring your use of this app complies with all applicable laws and third-party terms.

## License

This project is licensed under the [MIT License](LICENSE).

---

*IVIDS is not affiliated with Netflix, TMDb, or vidsrc.to.*
