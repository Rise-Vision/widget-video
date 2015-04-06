/* jshint expr: true */

(function () {
  "use strict";

  /* https://github.com/angular/protractor/blob/master/docs/getting-started.md */

  var chai = require("chai");
  var chaiAsPromised = require("chai-as-promised");

  chai.use(chaiAsPromised);
  var expect = chai.expect;

  browser.driver.manage().window().setSize(1024, 768);

  describe("Video Widget e2e Testing - via storage URL", function() {

    beforeEach(function () {
      // point directly to the widget e2e file
      browser.driver.get("http://localhost:8099/src/widget-storage-e2e.html");

      // need to ignore Angular synchronization, this is a non-angular page
      return browser.ignoreSynchronization = true;
    });

    it("Should apply correct background color", function () {
      // body background color
      expect(element(by.css("body")).getAttribute("style")).
        to.eventually.equal("background: rgba(100, 100, 100, 0);");
    });

    it("Should display background image", function () {
      // background image
      expect(element(by.id("background")).getAttribute("style")).
        to.eventually.equal("background-image: url(https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fmoon.jpg);");

      // scale to fit class should be applied
      expect(element(by.css("#background.scale-to-fit")).isPresent()).to.eventually.be.false;

      // correct positioning class
      expect(element(by.css(".bottom-right")).isPresent()).to.eventually.be.true;
    });

    it("Should load and display JW Player and video", function () {
      // jwplayer should have taken control of designated element
      expect(element(by.css("#videoJW.jwplayer")).isPresent()).to.eventually.be.true;

      browser.driver.wait(function() {
        return element(by.id("videoJW_view")).isPresent().then(function(el){
          return el === true;
        });
      }).
        then(function(){
          expect(element(by.id("videoJW_view")).isPresent()).to.eventually.be.true;

          // correct storage file url is set
          expect(element(by.css("#videoJW_view span.jwvideo video")).getAttribute("src")).
           to.eventually.equal("https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fa_food_show.webm");

          // TODO: figure out how JWPlayer is enabling / disabling controls based on

          // TODO: figure out how to differentiate between uniform stretching and none in JW Player

        });

    });

    xit("Should refresh the video", function () {
      //TODO: figure out how to get sinon.fakeTimers to work
    });
  });

})();
