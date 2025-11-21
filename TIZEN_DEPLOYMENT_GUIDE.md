# Deploying IVIDS to Tizen SDK (Samsung Smart TV)

## ✅ Fixed Issues
- **Settings now opens within the app** (not a new tab)
- Settings button uses internal router navigation
- All navigation stays within the single-page app structure

---

## 📱 Tizen App Structure

Your IVIDS app is actually **perfect for Tizen** because it's already structured as a **single-page application (SPA)** using a router. This is exactly what Tizen TVs expect!

### Current Structure (Already Tizen-Compatible ✓)
```
main/gui/
├── index.html          # Main entry point
├── config.xml          # (You'll need to create this)
├── icon.png            # (App icon for Tizen store)
├── css/
│   └── style.css
├── js/
│   ├── app.js          # Main app logic
│   ├── router.js       # Page routing
│   └── spatial-nav.js  # TV navigation
└── pages/
    ├── home.html/js
    ├── movies.html/js
    ├── series.html/js
    ├── search.html/js
    ├── settings.html/js
    └── ...
```

---

## 🔧 Steps to Package for Tizen

### 1. Create `config.xml` (Required)

Create this file in `main/gui/` directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" 
        xmlns:tizen="http://tizen.org/ns/widgets" 
        id="http://yourdomain.com/ivids" 
        version="1.0.0" 
        viewmodes="maximized">
    
    <tizen:application id="yourAppID.ivids" package="yourAppID" required_version="6.0"/>
    
    <content src="index.html"/>
    
    <feature name="http://tizen.org/feature/screen.size.normal.1080.1920"/>
    
    <icon src="icon.png"/>
    
    <name>IVIDS</name>
    <description>Video Streaming Application for Samsung Smart TV</description>
    <author href="http://yourdomain.com" email="your@email.com">Your Name</author>
    
    <tizen:profile name="tv-samsung"/>
    
    <tizen:privilege name="http://tizen.org/privilege/internet"/>
    <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
    
    <tizen:setting screen-orientation="landscape" 
                   context-menu="enable" 
                   background-support="disable" 
                   encryption="disable" 
                   install-location="auto"/>
</widget>
```

### 2. Create App Icon

Create an `icon.png` file (512x512px recommended) in `main/gui/`:
- PNG format
- Square dimensions
- Transparent or solid background
- Represents your IVIDS brand

### 3. Update index.html for Tizen

Your `index.html` is mostly ready, but add these meta tags in the `<head>`:

```html
<meta name="viewport" content="width=1920, height=1080, initial-scale=1.0, user-scalable=no">
<meta name="description" content="IVIDS - Video Streaming for Samsung Smart TV">
```

### 4. Add Tizen TV Remote Control Support

Your `spatial-nav.js` already handles this, but ensure it supports these Tizen-specific keys:

```javascript
// Key codes for Samsung TV remote
const TV_KEY_CODES = {
    BACK: 10009,      // Back button
    EXIT: 10182,      // Exit button  
    ENTER: 13,        // OK/Enter button
    LEFT: 37,         // D-pad Left
    UP: 38,           // D-pad Up
    RIGHT: 39,        // D-pad Right
    DOWN: 40,         // D-pad Down
    RED: 403,         // Color buttons
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    REWIND: 412,
    FAST_FORWARD: 417
};
```

---

## 🛠️ Building and Installing

### Option 1: Using Tizen Studio (Recommended)

1. **Install Tizen Studio**:
   - Download from: https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html
   - Include "TV Extensions" during installation

2. **Create New Project**:
   - Open Tizen Studio
   - File > New > Tizen Project
   - Select "Template" > "Web Application" > "Basic Project"
   - Give it a name (e.g., "IVIDS")

3. **Replace Project Files**:
   - Delete the default template files
   - Copy all your files from `main/gui/` to the project folder
   - Ensure `config.xml` and `icon.png` are in the root

4. **Build Package**:
   - Right-click project > Build Signed Package
   - This creates a `.wgt` file (Tizen Web App package)

5. **Install on TV**:
   - Enable Developer Mode on your TV:
     - Go to Apps
     - Press `12345` on remote
     - Toggle Developer Mode ON
     - Enter your computer's IP address
   - In Tizen Studio: Device Manager > Connect to TV
   - Right-click project > Run As > Tizen Web Application

### Option 2: Manual Packaging (Advanced)

```bash
# Navigate to your app directory
cd "C:\Users\kenji\Documents\projects for fun\IVIDS\main\gui"

# Create .wgt package (using Tizen CLI)
tizen package -t wgt -s <your-security-profile>

# Install on connected TV
tizen install -n IVIDS.wgt -t <device-name>
```

---

## 🎯 Important Tizen-Specific Changes Needed

### 1. **Update `app.js`** for Tizen lifecycle:

Add this at the top of `app.js`:

```javascript
// Tizen app lifecycle
if (typeof tizen !== 'undefined') {
    window.addEventListener('tizenhwkey', function(e) {
        if (e.keyName === 'back') {
            var page = document.getElementById('main-view');
            if (/* check if on home page */) {
                tizen.application.getCurrentApplication().exit();
            } else {
                Router.loadPage('home'); // Go back to home
            }
        }
    });
}
```

### 2. **Update Settings Storage**:

Currently using `localStorage` which works on Tizen, but consider using Tizen's preference API for better performance:

```javascript
// Instead of localStorage
if (typeof tizen !== 'undefined') {
    tizen.preference.setValue('ivids-settings', JSON.stringify(settings));
} else {
    localStorage.setItem('ivids-settings', JSON.stringify(settings));
}
```

### 3. **Handle TV Resolution**:

Your viewport is already set to 1920x1080 ✓, but you might want to support 4K TVs:

```css
/* Add to style.css */
@media (min-width: 3840px) {
    /* 4K TV adjustments */
    body {
        font-size: 1.5em;
    }
}
```

---

## 🧪 Testing Without a TV

### Tizen Studio Emulator:
1. Tools > Emulator Manager
2. Create > TV > Select version (6.0+)
3. Launch emulator
4. Deploy your app to the emulator

### Browser Testing:
- Your app works in Chrome/Edge for development
- Use Chrome DevTools: F12 > Toggle Device Toolbar
- Set to 1920x1080 resolution
- Test with keyboard arrows (mimic TV remote)

---

## 📦 Deployment Checklist

Before deploying to a real TV or Samsung App Store:

- [ ] `config.xml` created with correct app ID
- [ ] `icon.png` added (512x512px)
- [ ] Tizen remote control keys handled
- [ ] Back button behavior implemented
- [ ] App tested on emulator
- [ ] Signed with security profile
- [ ] .wgt package created
- [ ] Tested on actual Samsung TV (if available)

---

## 🚀 Publishing to Samsung TV App Store

If you want to publish publicly:

1. **Register as Samsung Developer**:
   - https://seller.samsungapps.com/
   - Create account and verify

2. **Prepare Store Assets**:
   - Screenshots (1920x1080)
   - App description
   - Privacy policy
   - Terms of service

3. **Submit App**:
   - Upload signed `.wgt` file
   - Fill in app details
   - Submit for review
   - Wait for approval (usually 1-2 weeks)

---

## 🔍 Common Issues & Solutions

### Issue: App won't install on TV
**Solution**: Make sure TV Developer Mode is enabled and TV is on same network as your computer

### Issue: Remote control doesn't work
**Solution**: Check that `spatial-nav.js` listens for proper key codes (37,38,39,40 for arrows)

### Issue: localStorage doesn't persist
**Solution**: Use Tizen Preference API instead (see above)

### Issue: Videos won't play
**Solution**: Ensure video URLs are HTTPS and codecs are supported (H.264, VP9)

---

## 💡 Tips for TV App Development

1. **Focus Management**: TVs don't have mouse - everything is remote-based
2. **Large Fonts**: TV viewers sit far away - use bigger text
3. **High Contrast**: TVs vary in quality - use high contrast colors
4. **Simple Navigation**: Keep menus simple and logical
5. **Test on Real Hardware**: Emulators don't always match real TV behavior

---

## 📚 Resources

- **Tizen TV Documentation**: https://developer.samsung.com/smarttv/develop/specifications/tv-model-groups.html
- **Web App Guide**: https://developer.samsung.com/smarttv/develop/guides/fundamentals/web-app-overview.html
- **Tizen Studio Download**: https://developer.tizen.org/development/tizen-studio/download
- **Sample Apps**: https://github.com/Samsung/TizenTVApps

---

## ✅ Summary

Your app is **already well-structured** for Tizen! You just need to:

1. Add `config.xml`
2. Add `icon.png`
3. Install Tizen Studio
4. Package as `.wgt`
5. Deploy to TV or emulator

The fact that you built it as a Single Page Application with a router makes it perfect for TV deployment! 🎉