const {Builder, By} = require('selenium-webdriver');
const fsPromise = require('./fsPromise');

if (process.argv.length !== 4) {
  console.log('Usage: node webCrawler.js -s [queryString] or Usage: node webCrawler.js -f [fileName]');
  process.exit(1);
}

const driver = new Builder().forBrowser('chrome').build();
let apps = [];
let fd;

if (process.argv[2] === '-s') {
  webCrawler(process.argv[3])
    .then(() => driver.quit());
} else if (process.argv[2] === '-f') {
  fsPromise.readFile(process.argv[3])
    .catch((err) => {
      console.log('Error occurred when reading file ' + process.argv[3] + '.\n' + err);
    })
    .then((string) => string.split('\n'))
    .then((queryStrings) => {
      return queryStrings.reduce((sequence, queryString) => {
        return sequence
          .then(() => webCrawler(queryString))
          .catch((err) => console.log('Error occured when crawling ' + queryString + '\'s content.\n' + err));
      }, Promise.resolve());
    })
    .then(() => driver.quit());
}

/**
 * Crawls the apps' name, url, and developer's email in google play store based on the queryString
 * store the result in queryString_result.csv
 * 1. navigate to playstore search page
 * 2. get all apps' name and href
 * 3. get all apps' developer's email
 * 4. write the data to [querystring]_result.csv
 * @param {function} queryString A function that checks whether the page is expandable and returns the expand method.
 * @return {promise} A promise chain that crawls the content.
 */
function webCrawler(queryString) {
  return new Promise((resolve) => {
    console.log('Start Crawling ' + queryString + ' content!');
    apps = [];
    resolve();
  })
    .then(() => driver.get('https://play.google.com/store/search?q=' + queryString + '&c=apps'))

    // I found out that some times the apps came out after expanding the page are repeated.
    // To disable the expand page function. Comment the following two lines.
    .then(() => expandPagePromise(checkExpandablePromise, operatePagePromise))
    .catch((err) => console.log('Error occured when expanding page.\n' + err))

    .then(() => driver.findElements(By.css('a.title')))
    .then((elements) => getAppsDataPromise(elements))
    .then(() => getAppDeveloperEmailPromise(apps))
    .then(() => fsPromise.open('./' + queryString + '_result.csv', 'w'))
    .then((_fd) => {
      fd = _fd;
      return writeAppData(fd);
    })
    .then(() => fsPromise.close(fd))
    .then(() => console.log('Finish Crawling ' + queryString + ' content!'));
}

/**
 * Expand page until it is not expandable.
 * @param {function} condition A function that checks whether the page is expandable and returns the expand method.
 * @param {function} action A function that of operates the pages based on the method condition function returned.
 * @return {promise} A promise that resolve app's data when success and reject error when fail.
 */
function expandPagePromise(condition, action) {
  const whilst = (data) => {
    return condition(data).then((methodString) => {
      console.log(methodString);
      if (methodString !== 'not expandable') {
        return action(methodString).then(whilst);
      } else {
        return;
      }
    });
  };
  return whilst([]);
};

/**
 * Operate page and wait 2s for the page to expand.
 * @param {string} methodString A string that indicates how to operate the page.
 * @return {promise} A promise that resolve app's data (array) when success and reject error when fail.
 */
function operatePagePromise(methodString) {
  let method;
  let oldData;
  if (methodString === 'scroll') {
    method = () => driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  } else if (methodString === 'button') {
    method = () => driver.findElement(By.id('show-more-button')).then((el) => el.click());
  }
  return driver.findElements(By.css('a.title'))
    .then((data) => oldData = data)
    .then(() => method())
    .then(() => new Promise((resolve, reject) => {
      setTimeout(() => resolve(oldData), 2000);
    }));
}


/**
 * Compare the number of old and new elements and check if there exist 'show-more-button'
 * to determine whether it is still expandable.
 * @param {array} elements An array of WebElements.
 * @return {promise} A promise that return a string indicating whether it is still expandable.
 */
function checkExpandablePromise(elements) {
  return driver.findElements(By.css('a.title'))
    .then((newElements) => {
      console.log(newElements.length);
      console.log(elements.length);
      if (newElements.length > elements.length) {
        return 'scroll';
      } else {
        return driver.findElement(By.id('show-more-button'))
          .then((element) => element.getCssValue('display'))
          .then((displayValue) => (displayValue === 'none')? 'not expandable' : 'button');
      }
    });
}

/**
 * Get app's title and href.
 * This is a sequential Promise implemented by Array.prototype.reduce.
 * @param {array} elements An array of WebElements.
 * @return {promise} A promise that resolve app's data (array) when success and reject error when fail.
 */
function getAppsDataPromise(elements) {
  let currentTitle;
  return elements.reduce((sequence, element, index) => {
    return sequence
      .then(() => element.getAttribute('title'))
      .then((title) => {
        currentTitle = title;
        console.log('Crawling ' + title + '\'s name and website url (' + (index+1) + '/' + (elements.length) + ')...');
      })
      .then(() => element.getAttribute('href'))
      .then((href) => {
        if (existInApps(href)) {
          console.log(currentTitle + ' is repeated!');
        } else {
          apps.push({name: currentTitle, href: href});
        }
      })
      .catch((err) => console.log('Error occured when getting ' + currentTitle + '\'s data.\n' + err));
  }, Promise.resolve());
}

/**
 * Get app's developer's email.
 * This is a sequential Promise implemented by Array.prototype.reduce.
 * @return {promise} A promise that resolve app's data (array) when success and reject error when fail.
 */
function getAppDeveloperEmailPromise() {
  return apps.reduce((sequence, app, index) => {
    return sequence
      .then(() => driver.get(app.href))
      .then(() => driver.findElement(By.partialLinkText('@')))
      .then((element) => element.getText())
      .then((email) => {
        console.log('Crawling ' + app.name + '\'s email (' + (index+1) + '/' + (apps.length) + ')...');
        return apps[index].email = email;
      })
      .catch((err) => console.log('Error occured when getting ' + app.name + '\'s email.\n' + err));
  }, Promise.resolve());
}

/**
 * Write apps' data into specified fd.
 * This is a sequential Promise implemented by Array.prototype.reduce.
 * @param {int} fd The file's fd user want to write the apps' data to.
 * @return {promise} A promise that resolve nothing when success and reject error when fail.
 */
function writeAppData(fd) {
  return fsPromise.write(fd, '"name","website url","email"\n')
    .then(() => apps.reduce((sequence, app, index) => {
      return sequence
        .then(() => fsPromise.write(fd, '"' + app.name + '","' + app.href + '","' + app.email + '"' + '\n'))
        .catch((err) => console.log('Error occured when writing ' + app.name + '\'s data.\n' + err));
    }, Promise.resolve())
  );
}

/**
 * Determine whether the app is already in apps.
 * @param {string} url The app's url.
 * @return {bool} A boolean value indicates whether the app is already in apps.
 */
function existInApps(url) {
  for (let i=0; i<apps.length; i++) {
    if (apps[i].href === url) return true;
  }
  return false;
}
