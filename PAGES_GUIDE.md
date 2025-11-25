# IVIDS Page Guide

This document provides a detailed explanation of each page in the IVIDS application, including its structure, features, and functionality.

## 🏠 Home Page (`home.html`)

The **Home** page is the landing page of the application, designed to provide users with immediate access to trending and popular content.

### **Structure**
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

### **Functionality**
-   **Navigation**: Users can navigate through the hero buttons and content rows using the keyboard or remote control (spatial navigation).
-   **Dynamic Loading**: Content is fetched from the TMDb API.
-   **Interactivity**: Clicking a poster navigates to the **Details** page for that item.

---

## 🎬 Movies Page (`movies.html`)

The **Movies** page is dedicated specifically to film content, allowing users to explore various genres.

### **Structure**
1.  **Hero Section**:
    -   Similar to the Home page but features a popular *movie*.
2.  **Genre Rows**:
    -   **Popular Movies**: The most popular films right now.
    -   **Top Rated**: Critically acclaimed films.
    -   **Genres**: Action, Comedy, Adventure, Animation, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Sci-Fi, Thriller, War, Western.

### **Functionality**
-   Focuses purely on movies, filtering out TV shows.
-   Provides a deep dive into specific film genres.

---

## 📺 Series Page (`series.html`)

The **Series** page is dedicated to TV shows and series.

### **Structure**
1.  **Hero Section**:
    -   Features a popular *TV show*.
2.  **Genre Rows**:
    -   **Popular Series**: Trending TV shows.
    -   **Top Rated Series**: Highly rated shows.
    -   **Genres**: Action & Adventure, Animation, Crime, Documentary, Drama, Family, Kids, Mystery, Reality, Sci-Fi & Fantasy, Soap, War & Politics, Western.

### **Functionality**
-   Focuses purely on TV content.
-   Includes specific genres relevant to TV (e.g., Soap, Reality, Kids).

---

## 🔍 Search Page (`search.html`)

The **Search** page allows users to find specific content and filter results based on their preferences.

### **Structure**
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

### **Functionality**
-   **Real-time Filtering**: Changing filters updates the results.
-   **Explicit Content**: This is the only area where 18+ content can be accessed if explicitly searched for.
-   **View Toggle**: Switch between grid and list views (if implemented).

---

## 📄 Details Page (`details.html`)

The **Details** page provides comprehensive information about a selected movie or TV show.

### **Structure**
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

### **Functionality**
-   **Contextual Data**: Displays different info for Movies vs. TV Shows (e.g., seasons/episodes).
-   **Playlist Management**: Users can add the current title to their custom playlists.
-   **Resume**: If previously watched, the "Play" button might function as "Resume".

---

## ⏯️ Player Page (`player.html`)

The **Player** page is the interface for video playback.

### **Structure**
1.  **Video Container**: Full-screen area for the video player (iframe or HTML5 video).
2.  **Controls**:
    -   **Play/Pause**: Toggle playback.
    -   **Stop**: Stop playback.
    -   **Back**: Return to the Details page.

### **Functionality**
-   **Streaming**: Embeds the video source (e.g., via vidsrc.to or similar).
-   **Progress Tracking**: Saves watch progress to allow resuming later.

---

## 💾 Playlists Page (`playlists.html`)

The **Playlists** page allows users to manage their personal collections of content.

### **Structure**
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

### **Functionality**
-   **CRUD Operations**: Create, Read, Update (add/remove items), Delete playlists.
-   **Persistence**: Playlists are saved in `localStorage`.

---

## ⚙️ Settings Page (`settings.html`)

The **Settings** page allows users to customize the application.

*For a full detailed guide on the Settings system, please refer to [`SETTINGS_README.md`](SETTINGS_README.md).*

### **Key Features**
-   **Language**: Change interface language.
-   **Accent Color**: Customize the primary theme color.
-   **Reset**: Clear data.
