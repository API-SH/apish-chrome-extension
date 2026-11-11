# API.SH Chrome extension

Turn the page you are on into clean JSON or CSV with your API.SH key: open a TikTok profile, an Amazon product, a Zillow listing or a page on any of around 1,000 supported websites, click the extension, pick what you want and get the data.

- `manifest.json` (MV3), popup in `src/popup.*`, key settings in `src/options.*`.
- Platforms, endpoints and credits come live from `https://api.api.sh/catalog`, and each endpoint's parameters from `/catalog?route=` (`src/catalog.js`; JSON data only, cached an hour in `chrome.storage.local`). New platforms, endpoints and price changes need no new extension version.
- `src/endpoints.json` is the offline fallback (used when the API can't be reached and nothing is cached), and the only source of each site's domains, used to recognise the page you're on. Platforms it doesn't know are recognised by name (`home-depot` matches `homedepot.com`); regenerate it from time to time to improve that, but it isn't required.
- Permissions: `activeTab` (to read the current tab's URL when you open the popup), `storage` (your key, the cached catalog), and `https://api.api.sh/*`.

## Install

- From the [Chrome Web Store](https://chromewebstore.google.com/detail/nahdpjmcmdoeiojepjkiaanabbmjimod), or
- from source: open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick this folder.

Then open the extension's options and paste your API key from [app.api.sh](https://app.api.sh/keys?utm_source=github&utm_medium=readme). Every account gets free monthly credits.

## License

MIT
