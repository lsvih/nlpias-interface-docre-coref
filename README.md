# nlpias-interface-sequence-tagging

Template for building annotation interface of [nlpias](https://github.com/lsvih/nlpias)

![Screenshot](/resources/screenshot.png)

## Debug config

- Run `yarn serve`
- Serve umd module `dist/nlpias-interface.umd.min.js` (e.g `python3 -m http.server --directory dist 8080` or `http-server dist -p 8080`)
- Set interface url as `localhost:port/nlpias-interface.umd.min.js`

## Build

`yarn build`