# Documentation

## How to Run

```
DEBUG=true \
HEADFUL=true \
API_ENDPOINT=https://api.test.com/cookie/upload \
ALIMAMA_USERNAME=xxx \
ALIMAMA_PASSWORD=yyy \
node index.js
```

## Setup Yarn Proxy (Optional)

```shell
yarn config set proxy http://127.0.0.1:7890
yarn config set https-proxy http://127.0.0.1:7890
```

## Reference and Documentation

* [puppeteer](https://github.com/puppeteer/puppeteer)
* [puppeteer-extra](https://github.com/berstend/puppeteer-extra)

## Using Google Chrome instead of Chromium

* [Reference](https://github.com/berstend/puppeteer-extra/wiki/Using-Google-Chrome-instead-of-Chromium)

## Chrome launch arguments

* [Reference 1](https://github.com/berstend/puppeteer-extra/wiki/Chrome-launch-arguments)
* [Reference 2](https://github.com/GoogleChrome/chrome-launcher/blob/master/docs/chrome-flags-for-tools.md)

## How to Debug

* In Chrome Console `$x('xpath')` or `$('selector')`
* [Reference](https://github.com/berstend/puppeteer-extra/wiki/How-to-debug-puppeteer-and-headless-browsers)
* `chrome://inspect` (注意如果打开实时观看操作,page.mouse 或者 page.click 可能会有异常, 必要时可通过 page.screenshot 来观察调试避免异常影响判断)
