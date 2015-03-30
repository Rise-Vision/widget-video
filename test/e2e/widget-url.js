/* jshint expr: true */

(function () {
  "use strict";

  /* https://github.com/angular/protractor/blob/master/docs/getting-started.md */

  var chai = require("chai");
  var chaiAsPromised = require("chai-as-promised");
  var sinon = require("sinon");

  chai.use(chaiAsPromised);
  var expect = chai.expect;

  browser.driver.manage().window().setSize(1024, 768);

  var clock;

  describe("Video Widget e2e Testing - via non-storage URL", function() {

    beforeEach(function () {
      // point directly to the widget e2e file
      browser.driver.get("http://localhost:8099/src/widget-url-e2e.html");

      clock = sinon.useFakeTimers();

      // need to ignore Angular synchronization, this is a non-angular page
      return browser.ignoreSynchronization = true;
    });

    afterEach(function () {
      clock.restore();
    });

    it("Should apply correct background color", function () {
      // body background color
      expect(element(by.css("body")).getAttribute("style")).
        to.eventually.equal("background: rgba(145, 145, 145, 0);");
    });

    it("Should display background image", function () {
      // background image
      expect(element(by.id("background")).getAttribute("style")).
        to.eventually.equal("background-image: url(http://s3.amazonaws.com/rise-common/images/logo-small.png);");

      // scale to fit class should be applied
      expect(element(by.css("#background.scale-to-fit")).isPresent()).to.eventually.be.true;

      // correct positioning class
      expect(element(by.css(".middle-center")).isPresent()).to.eventually.be.true;
    });

    xit("Should load and display video", function () {
      // video controls should not be displayed
      expect(element(by.id("video")).getAttribute("controls")).to.eventually.not.be.null;

      // scale to fit class should be applied
      expect(element(by.css("video.scale-to-fit")).isPresent()).to.eventually.be.true;

      // source element should exist
      expect(element(by.tagName("source")).isPresent()).to.eventually.be.true;

      // source element should apply "src" attribute with correct value
      expect(element(by.tagName("source")).getAttribute("src")).
        to.eventually.equal("https://s3.amazonaws.com/risecontentfiles/tests/a_RFID.webm");

      // video container should be visible
      expect(element(by.id("videoContainer")).isPresent()).to.eventually.be.true;
      expect(element(by.id("videoContainer")).isDisplayed()).to.eventually.be.true;

    });

    xit("Should refresh the video with a cachebusting url", function () {

      // ***************************//

      // The example below passes
      // http://stackoverflow.com/questions/17446064/how-can-i-simulate-the-passing-of-time-in-mocha-tests-so-that-settimeout-callbac

      /*var timedOut = false;
      setTimeout(function () {
        timedOut = true;
      }, 500);

      expect(timedOut).to.be.false;

      clock.tick(510);

      expect(timedOut).to.be.true;*/

      // ************************** //

      /*
        TODO: This real attempt below does not pass, the "src" value is still the same after
        forwarding the clock past 900000
       */

      browser.driver.wait(function() {
        return element(by.id('videoContainer')).isDisplayed().then(function(el){
          return el === true;
        });
      }).
        then(function(){
          expect(element(by.tagName("source")).getAttribute("src")).to.eventually.equal("https://s3.amazonaws.com/risecontentfiles/tests/a_RFID.webm");

          clock.tick(900500);

          expect(element(by.tagName("source")).getAttribute("src")).to.eventually.not.equal("https://s3.amazonaws.com/risecontentfiles/tests/a_RFID.webm");

        });

    });

  });

})();
