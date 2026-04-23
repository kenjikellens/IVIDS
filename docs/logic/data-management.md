# User Data Management

All persistent user data is stored locally on the device using `localStorage`.

## Storage Keys
- `ivids-settings`: Hex accent color and language code.
- `ivids-profiles`: Array of user profiles (Name, Color, PIN).
- `ivids-playlists`: Custom media lists created by users.
- `ivids-recently-watched`: History of played content with progress tracking.
- `ivids-active-profile`: Current logged-in user.

## Data Structures

### Profile
```json
{
    "id": "profile_123",
    "name": "John",
    "color": "#e50914",
    "pin": "1234"
}
```

### Playlist Item
```json
{
    "id": 12345,
    "type": "movie",
    "title": "Inception",
    "posterPath": "/path.jpg"
}
```

## Security
Profile PINs are stored as plain text in `localStorage`. This is designed for simple parental control/privacy on shared TVs, not high-security data protection.
