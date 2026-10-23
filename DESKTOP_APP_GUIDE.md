# Global Minds Lead Tracker - Desktop Application Guide

This project has been transformed into a standalone **Windows Desktop Application** using **Electron** and **Vite**.

---

## 🚀 Quick Start: How to Run the Desktop App

### 1. Ready-to-Use Windows Executables
You already have two pre-built binaries ready in the `release/` folder:
- **Portable App (No install required):**
  - Path: `release/Global Minds Lead Tracker 1.0.0.exe`
  - Simply **double-click** to open and run immediately from any folder or USB drive.
- **Windows Setup Installer:**
  - Path: `release/Global Minds Lead Tracker Setup 1.0.0.exe`
  - Installs the app onto Windows, allows selecting the installation directory, and automatically creates a **Desktop Shortcut** and **Start Menu Shortcut**.

---

### 2. Run in Desktop Development Mode (Live Reloading)
To run the desktop application while actively editing code with instant Hot Module Replacement (HMR):
```bash
npm run electron:dev
```
This starts the Vite dev server and automatically launches the Electron desktop window. Any UI changes made in React/CSS will update inside the desktop app instantly.

---

### 3. Run Production Desktop Preview
To test how the desktop app runs with compiled production assets:
```bash
npm run build
npm run electron:start
```

---

### 4. Build Fresh Windows Executables (.exe)
Whenever you want to package a new version of the desktop app:
- **Build both Installer & Portable:**
  ```bash
  npm run electron:build
  ```
- **Build only Portable .exe:**
  ```bash
  npm run electron:build:portable
  ```
The newly compiled standalone executables will be placed in the `release/` folder.

---

## 📁 Key Desktop Configuration Files
- **[`electron/main.cjs`](file:///c:/Users/sneha/OneDrive/Desktop/Todolist/electron/main.cjs)**: Main Electron process configuring desktop window size, background color, app icon, and secure external URL opening.
- **[`electron/preload.cjs`](file:///c:/Users/sneha/OneDrive/Desktop/Todolist/electron/preload.cjs)**: Context bridge script exposing desktop helpers securely to the React frontend.
- **[`electron-builder.json`](file:///c:/Users/sneha/OneDrive/Desktop/Todolist/electron-builder.json)**: Packaging specifications for generating the Windows executable.
- **[`vite.config.ts`](file:///c:/Users/sneha/OneDrive/Desktop/Todolist/vite.config.ts)**: Configured with `base: './'` for desktop `file://` asset resolution and a fixed server port.
