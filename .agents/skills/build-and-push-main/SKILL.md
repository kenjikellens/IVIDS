---
name: build-and-push-main
description: Standardized step-by-step protocol to build Windows EXE and Android APK binaries, verify compilation, commit changes, and push directly to the main branch without creating a GitHub release or tag.
---

# Build and Push to Main Workflow

Dit document definieert het gestandaardiseerde protocol voor het compileren van de Windows Portable Executable (`IVIDS.exe`) en de Android APK (`IVIDS.apk`), het verifiëren van de bijgewerkte configuratiebestanden, en het direct pushen van de commits naar `main` zonder een Git-tag of GitHub Release aan te maken.

---

## 📋 Welke bestanden worden bijgewerkt? (File Update Checklist)

Bij het uitvoeren van deze workflow worden de volgende bestanden bijgewerkt en moeten worden gecontroleerd/gestaged:

1. **`app/build.gradle.kts`**:
   - **`versionCode`**: Wordt bij **elke** build-uitvoering automatisch met 1 opgehoogd via `increment-version-code.js`.
   - **`versionName`**: Wordt bijgewerkt indien er een optionele versiebump wordt meegegeven.
2. **Optioneel bij versiebump (`.\build.bat version vX.Y.Z`)**:
   - **`package.json` & `package-lock.json`**: Versiestring voor Electron en Windows Settings.
   - **`app/src/main/config.xml` & `app/src/main/assets/main/config.xml`**: Versieattribuut voor Tizen TV.
   - **`CHANGELOG.md`**: Versie- en datumlog entry.
3. **Gewijzigde applicatiebronbestanden**:
   - Alle gewijzigde features, fixes of stijlen onder `app/src/main/assets/main/` (bijv. JS, CSS, HTML).
4. **Binaire uitvoerbestanden (gegenereerd in de projectroot)**:
   - **`IVIDS.exe`**: De gecompileerde Windows Portable Executable (staat in `.gitignore`, wordt **niet** gecommit in git).
   - **`IVIDS.apk`**: De gecompileerde Android installatie-APK (staat in `.gitignore`, wordt **niet** gecommit in git).

---

## 🛠️ Step-by-Step Protocol

### 1. Pre-Build Validation & Status Check
- **ACTION**: Controleer de huidige git-status en controleer welke bestanden zijn gewijzigd:
  ```powershell
  git status
  ```
- **Integrity Validation**: Valideer dat de projectconfiguratie en versie-identifiers synchroon zijn:
  ```powershell
  node validate-build-integrity.js
  ```
- **Code Syntax Check**: Controleer dat alle gewijzigde JS/TS-bestanden foutloos compileren:
  ```powershell
  node -c <bestand.js>
  ```

---

### 2. Compileer en Package de Applicaties (Verplichte EXE & APK Generatie)
- **ACTION**: Start het geautomatiseerde buildscript om **BEIDE** binaries tegelijkertijd te bouwen:
  - Voor **Debug Build** (standaard debug-pakketten):
    ```powershell
    .\build.bat
    ```
  - Voor **Release Build** (geoptimaliseerde, met `keystore.jks` gesigneerde productie-pakketten):
    ```powershell
    .\build.bat release
    ```
- **Wat `build.bat` automatisch doet**:
  1. **Hoogt `versionCode` op**: Draait `increment-version-code.js` en werkt `app/build.gradle.kts` bij.
  2. **Compileert Windows EXE**: Bouwt de Electron portable executable via `npm run dist`.
  3. **Compileert Android APK**: Bouwt de Android APK via `gradlew.bat assembleDebug` of `assembleRelease`.
  4. **Kopieert en hernoemt naar root**: Plaatst `IVIDS.exe` en `IVIDS.apk` direct in de workspace root.
  5. **Ruimt tijdelijke mappen op**: Verwijdert de `dist/` buildmap.

---

### 3. Verifieer de Binaire Bestanden (EXE & APK)
- **ACTION**: Verifieer dat zowel `IVIDS.exe` als `IVIDS.apk` succesvol zijn aangemaakt in de workspace root en niet 0 bytes zijn:
  ```powershell
  Get-Item "IVIDS.exe", "IVIDS.apk" | Select-Object Name, Length, LastWriteTime
  ```
- **Let op**: `IVIDS.exe` en `IVIDS.apk` staan in `.gitignore` en worden niet in git opgeslagen, maar dienen voor lokale distributie en testing.

---

### 4. Stage en Commit de Gewijzigde Bestanden
- **ACTION**: Stage de gewijzigde bronbestanden en de automatisch opgehoogde `app/build.gradle.kts`:
  ```powershell
  git add app/build.gradle.kts
  git add app/src/
  # Voeg overige gewijzigde bestanden toe
  ```
- **Commit met duidelijke boodschap**:
  ```powershell
  git commit -m "feat/fix: <korte samenvatting>" -m "- <detail 1>`n- <detail 2>`n- <detail 3>"
  ```

---

### 5. Push naar de Main Branch (ZONDER Release of Tag)
- **ACTION**: Haal eventuele externe wijzigingen op en push direct naar de `main` branch:
  ```powershell
  git fetch origin main
  git push origin main
  ```
- **VEILIGHEIDSREGELS & VERSCHIL MET RELEASE WORKFLOW**:
  - ❌ **GEEN Git-tag aanmaken** (`git tag -a ...`).
  - ❌ **GEEN tags pushen** (`git push origin v...`).
  - ❌ **GEEN GitHub Release publiceren** (`gh release create ...`).
  - ✅ **WEL** controleren dat de push naar `origin/main` geslaagd is:
    ```powershell
    git status
    ```

