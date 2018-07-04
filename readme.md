Google Play Web Crawler
===

## Description
A web crawler that crawls the app's name, url, and email of google play store.
It is based on node.js and selenium.

## Installation
```
git clone https://github.com/CannedAnchovy/GooglePlayWebCrawler.git
cd GooglePlayWebCrawler
npm install
```
If you haven't installed selenium's webDriver for chrome, download and install it [here](http://chromedriver.chromium.org/).

## Usage
crawls the search result of a single keyword
```
node ./webCrawler.js -s [keyword]
```
crawls the search result of a multiple keywords stored in a file
```
node ./webCrawler.js -f [file path]
```
The specified file should consist of only keywords and '\n'.
You can look up the file 'keyword-example' for example.

## Output
If the crawler executes successfully, the result will be stored in [keyword]_result.csv.
There will be three columns in this file, which is app's name, url, and email.
