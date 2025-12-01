# IVIDS Tizen TV Deployment Guide

This guide provides step-by-step instructions on how to install and deploy the IVIDS application to a Samsung Smart TV running Tizen OS.

## 📋 Prerequisites

Before you begin, ensure you have the following:

1.  **Samsung Smart TV**: Tizen OS 4.0 or higher (Models 2017+).
2.  **Computer**: Windows, macOS, or Linux.
3.  **Tizen Studio**: The official IDE for Tizen development.
4.  **Samsung Account**: Required for generating certificates.
5.  **Network**: TV and Computer must be connected to the **same network** (Wi-Fi or Ethernet).

---

## 🛠️ Step 1: Install Tizen Studio

1.  **Download Tizen Studio**:
    -   Visit the [Tizen Studio Download Page](https://developer.tizen.org/development/tizen-studio/download).
    -   Download the installer for your operating system.

2.  **Install the IDE**:
    -   Run the installer and follow the on-screen instructions.
    -   **Important**: When prompted to launch the **Package Manager**, select "Yes".

3.  **Install Required Extensions**:
    -   In the Package Manager, go to the **Extension SDK** tab.
    -   Look for **TV Extensions** (e.g., `TV Extensions-6.0` or the latest version).
    -   Click **Install**. This is crucial for Samsung TV support.

---

## ⚙️ Step 2: Project Configuration

If you have cloned the repository, you need to ensure the Tizen configuration files are present.

### 1. Create `config.xml`

Create a file named `config.xml` in the `main/gui/` directory with the following content. This file defines the app's identity and permissions.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" 
        xmlns:tizen="http://tizen.org/ns/widgets" 
        id="http://yourdomain.com/ivids" 
        version="1.0.0" 
        viewmodes="maximized">
    
    <tizen:application id="yourAppID.ivids" package="yourAppID" required_version="4.0"/>
    
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

### 2. Add an App Icon

1.  Create or find a PNG image (recommended size: **512x512 pixels**).
2.  Name it `icon.png`.
3.  Place it in the `main/gui/` directory.

---

## 📺 Step 3: Prepare Your TV

You need to enable "Developer Mode" on your Samsung TV to install custom apps.

1.  **Open the Apps Panel**:
    -   Press the **Home** button on your remote.
    -   Navigate to **Apps**.

2.  **Enter Developer Mode**:
    -   In the Apps screen, press the sequence `1`, `2`, `3`, `4`, `5` on your remote.
    -   A "Developer Mode" dialog should appear.
    -   Switch **Developer Mode** to **On**.

3.  **Enter Host IP**:
    -   In the same dialog, enter the **IP address of your computer** (the one running Tizen Studio).
    -   Click **OK**.
    -   **Restart your TV** (hold the Power button until the Samsung logo appears).

---

## 🔗 Step 4: Connect Tizen Studio to TV

1.  Open **Tizen Studio**.
2.  Launch the **Device Manager**:
    -   Click the icon in the toolbar or go to `Tools > Device Manager`.
3.  **Scan for Devices**:
    -   Click the **Remote Device Manager** icon (plus sign or network icon).
    -   Click **Scan**. Your TV should appear.
    -   Toggle the switch to **ON** to connect.
    -   *Note: If scanning fails, manually add the TV using its IP address.*

4.  **Certificate Setup** (One-time setup):
    -   Go to `Tools > Certificate Manager`.
    -   Click `+` to create a new certificate profile.
    -   Select **Samsung** (not Tizen).
    -   Select **TV** as the device type.
    -   Follow the wizard to sign in with your Samsung Account and create a certificate.
    -   **Important**: This certificate allows the app to run on your specific TV.

---

## � Step 5: Install the App

1.  **Import the Project**:
    -   In Tizen Studio, go to `File > Open Projects from File System`.
    -   Select the `main/gui` folder of the IVIDS repository.
    -   Ensure the project type is detected as "Web Application".

2.  **Run on TV**:
    -   In the **Project Explorer**, right-click the project folder.
    -   Select `Run As > Tizen Web Application`.
    -   The app will be packaged, transferred to your TV, and launched automatically.

---

## ❓ Troubleshooting

### App installs but shows a blank screen
-   Check `index.html` path in `config.xml`.
-   Ensure all CSS/JS files are correctly linked relative to `index.html`.

### "Signature verification failed"
-   This means your certificate is invalid or doesn't include your TV's DUID.
-   Open **Certificate Manager**, edit your profile, and ensure your connected TV is selected in the "Distributor Certificate" step.

### Remote control not working
-   Ensure `spatial-nav.js` or your key handler is listening for Tizen key codes (e.g., Left: 37, Up: 38, Right: 39, Down: 40, Enter: 13, Back: 10009).

### Cannot connect to TV
-   Verify both devices are on the same Wi-Fi network.
-   Disable firewall on your PC temporarily.
-   Double-check the IP address entered in the TV's Developer Mode settings.