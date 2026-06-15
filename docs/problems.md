# Known Problems and Issues

This document tracks known issues, architectural discrepancies, and performance bottlenecks identified within the IVIDS application.

## UI/UX & Layout Issues

### 1. Playlist Cards Aspect Ratio & Image Containment
- **Problem**: The list of playlists currently displays thumbnails/icons using a vertical `2:3` aspect ratio (like movie posters). Since playlist covers and list items are suited for horizontal imagery, they should be displayed in a horizontal `16:9` aspect ratio.
- **Image Fit**: In addition to updating the card container aspect ratio, the image or icon inside these playlist items must be configured to fit nicely (e.g., using `object-fit: cover` or appropriate CSS containment) so that they are not distorted, squished, or cropped awkwardly.
- **Impacted Components**: Playlist list item CSS/HTML containers (e.g., `playlists.html`, `playlists.css`, and related card generation logic).
