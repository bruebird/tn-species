# TFA Species Explorer

This is a static site for exploring Tennessee species by county and species group. It is designed for a local development, GitHub, and Netlify deployment workflow.

## Project structure

```text
.
├── assets
│   ├── data
│   │   └── species_by_county.json
│   ├── icons
│   │   └── *.svg
│   └── map
│       └── tennessee-county-map.svg
├── scripts
│   └── app.js
├── styles
│   └── main.css
├── index.html
├── species-explorer.html
└── netlify.toml
```

## Local development

From the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub setup (existing repo)

Use this repository:

- `https://github.com/bruebird/tn-species`

Then run:

```bash
git init
git add .
git commit -m "Refactor site structure and prep for Netlify"
git branch -M main
git remote add origin https://github.com/bruebird/tn-species.git
git pull origin main --allow-unrelated-histories
git push -u origin main
```

## Netlify deploy

1. In Netlify, select **Add new project** -> **Import an existing project**.
2. Choose GitHub and authorize access if prompted.
3. Select `bruebird/tn-species`.
4. Build settings:
   - Build command: *(leave blank)*
   - Publish directory: `.`
5. Click **Deploy site**.

After setup, every push to `main` will auto-deploy on Netlify.
