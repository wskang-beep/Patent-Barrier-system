# Deployment Guide - Coway Patent Analysis System

This guide explains how to share and deploy your patent analysis system.

## 1. Local Deployment
Simply open `index.html` in any modern web browser.
Ensure that `analysis.js` and `style.css` are in the same directory.

## 2. Web Hosting Deployment
If you want the system to be accessible via a public link (e.g., `https://your-name.github.io/patent-intel/`), follow these steps:

### Option A: GitHub Pages (Recommended)
1. Create a new repository on GitHub.
2. Push `index.html`, `analysis.js`, and `style.css` to the main branch.
3. In repository **Settings** > **Pages**, select the branch to serve (usually `main`).
4. Your site will be live at `https://[username].github.io/[repo-name]/`.

### Option B: Netlify
1. Go to [Netlify](https://www.netlify.com/).
2. Drag and drop the folder containing `index.html`, `analysis.js`, and `style.css` into the "Sites" area.
3. Netlify will provide a public link immediately.

## ⚠️ Security Warning
> [!WARNING]
> **API Key Exposure**: The Gemini API key is currently embedded in the JavaScript code. 
> - Anyone who visits your public link can see the key in the browser's developer tools.
> - **Recommendation**: For sensitive or production use, consider using a restricted API key with usage limits.

