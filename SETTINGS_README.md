<<<<<<< HEAD
# IVIDS Settings System

## Available Settings

The settings system currently supports two functional settings:

### 1. Language
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

### 2. Accent Color
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

## How It Works

### Storage
Settings are stored in `localStorage` under the key `ivids-settings` as a JSON object:
```json
{
  "language": "en",
  "accentColor": "#46d369"
}
```

### Application Flow
1. User opens the app → `app.js` loads settings from localStorage
2. Settings are applied to CSS variables and HTML attributes
3. User changes settings → `settings.js` saves to localStorage and updates UI in real-time
4. Settings persist across sessions

### Files Involved
- **`pages/settings.html`**: Settings UI page
- **`pages/settings.js`**: Settings logic and localStorage management
- **`js/app.js`**: Loads and applies settings on app startup
- **`css/style.css`**: Uses CSS variables for theming

## Usage

### Getting Current Settings (JavaScript)
```javascript
// From settings page
const settings = window.settingsManager.getSettings();

// From any page
const settings = window.getIVIDSSettings();
// Returns: { language: 'en', accentColor: '#46d369' }
```

### Applying Settings Programmatically
```javascript
// Change accent color
document.documentElement.style.setProperty('--primary-color', '#e50914');

// Save to localStorage
localStorage.setItem('ivids-settings', JSON.stringify({
  language: 'es',
  accentColor: '#e50914'
}));
```

## Future Enhancements

To fully implement these settings:

1. **Language System**:
   - Create translation files for each language
   - Implement i18n library or custom translation function
   - Update all UI text based on selected language

2. **Additional Color Variables**:
   - Add more CSS variables for fine-tuned theming
   - Support for dark/light mode toggle
   - Advanced color schemes (background, text, etc.)

## Testing

To test the settings:
1. Open the app at `index.html`
2. Click the settings icon in the top-right navbar
3. Change the language or accent color
4. You'll see a "Settings saved!" notification
5. Navigate back to the main app - changes are applied
6. Refresh the page - settings persist
=======
# IVIDS Settings System

## Available Settings

The settings system currently supports two functional settings:

### 1. Language
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

### 2. Accent Color
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

## How It Works

### Storage
Settings are stored in `localStorage` under the key `ivids-settings` as a JSON object:
```json
{
  "language": "en",
  "accentColor": "#46d369"
}
```

### Application Flow
1. User opens the app → `app.js` loads settings from localStorage
2. Settings are applied to CSS variables and HTML attributes
3. User changes settings → `settings.js` saves to localStorage and updates UI in real-time
4. Settings persist across sessions

### Files Involved
- **`pages/settings.html`**: Settings UI page
- **`pages/settings.js`**: Settings logic and localStorage management
- **`js/app.js`**: Loads and applies settings on app startup
- **`css/style.css`**: Uses CSS variables for theming

## Usage

### Getting Current Settings (JavaScript)
```javascript
// From settings page
const settings = window.settingsManager.getSettings();

// From any page
const settings = window.getIVIDSSettings();
// Returns: { language: 'en', accentColor: '#46d369' }
```

### Applying Settings Programmatically
```javascript
// Change accent color
document.documentElement.style.setProperty('--primary-color', '#e50914');

// Save to localStorage
localStorage.setItem('ivids-settings', JSON.stringify({
  language: 'es',
  accentColor: '#e50914'
}));
```

## Future Enhancements

To fully implement these settings:

1. **Language System**:
   - Create translation files for each language
   - Implement i18n library or custom translation function
   - Update all UI text based on selected language

2. **Additional Color Variables**:
   - Add more CSS variables for fine-tuned theming
   - Support for dark/light mode toggle
   - Advanced color schemes (background, text, etc.)

## Testing

To test the settings:
1. Open the app at `index.html`
2. Click the settings icon in the top-right navbar
3. Change the language or accent color
4. You'll see a "Settings saved!" notification
5. Navigate back to the main app - changes are applied
6. Refresh the page - settings persist
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
