"use strict";

describe("init()", function() {

  var params, url, skin;

  beforeEach(function () {
    params = {width: 1024, height: 768, video: {scaleToFit: true, volume: 50, controls: true, autoplay: true, pause: 10}};

    url = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest.webm";

    skin = "";
  });

  it("should correctly apply autoPlay value with consideration to params.video.controls", function () {
    init(params, url, skin);
    expect(autoPlay).to.be.true;

    params.video.controls = false;
    params.video.autoplay = false;
    init(params, url, skin);
    expect(autoPlay).to.be.true;
  });

  it("should correctly apply stretching value based on params.video.scaleToFit", function () {
    init(params, url, skin);
    expect(stretching).to.equal("uniform");

    params.video.scaleToFit = false;
    init(params, url, skin);
    expect(stretching).to.equal("none");
  });

  it("should correctly apply pauseDuration value based on params.video.pause", function () {
    init(params, url, skin);
    expect(pauseDuration).to.equal(10);

    params.video.pause = "te5t";
    init(params, url, skin);
    expect(pauseDuration).to.equal(0);

    params.video.pause = "30";
    init(params, url, skin);
    expect(pauseDuration).to.equal(30);

    params.video.pause = null;
    delete params.video.pause;
    init(params, url, skin);
    expect(pauseDuration).to.equal(0);

  });

});

describe("getVideoFileType()", function() {

  it("should return correct HTML5 video file type calling getVideoFileType()", function () {
    var baseUrl = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest";

    expect(getVideoFileType(baseUrl + ".webm")).to.equal("webm");
    expect(getVideoFileType(baseUrl + ".mp4")).to.equal("mp4");
  });

  it("should return null as the HTML5 video file type calling getVideoFileType()", function () {
    var baseUrl = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest";

    expect(getVideoFileType(baseUrl + ".flv")).to.be.null;
    expect(getVideoFileType(baseUrl + ".mov")).to.be.null;
    expect(getVideoFileType(baseUrl + ".avi")).to.be.null;
    expect(getVideoFileType(baseUrl + ".mpg")).to.be.null;
    expect(getVideoFileType(baseUrl + ".wmv")).to.be.null;
    expect(getVideoFileType(baseUrl + ".ogg")).to.be.null;
    expect(getVideoFileType(baseUrl + ".ogv")).to.be.null;
  });

});

describe("playerJW()", function() {

  it("should provide an object with required methods", function () {
    var playerInstance = playerJW({});

    expect(playerInstance.getDuration).to.exist;
    expect(playerInstance.getDuration).to.be.an("function");

    expect(playerInstance.getPosition).to.exist;
    expect(playerInstance.getPosition).to.be.an("function");

    expect(playerInstance.loadVideo).to.exist;
    expect(playerInstance.loadVideo).to.be.an("function");

    expect(playerInstance.play).to.exist;
    expect(playerInstance.play).to.be.an("function");

    expect(playerInstance.pause).to.exist;
    expect(playerInstance.pause).to.be.an("function");

    expect(playerInstance.onPlayerError).to.exist;
    expect(playerInstance.onPlayerError).to.be.an("function");

    expect(playerInstance.onSetupError).to.exist;
    expect(playerInstance.onSetupError).to.be.an("function");

    expect(playerInstance.stop).to.exist;
    expect(playerInstance.stop).to.be.an("function");

    expect(playerInstance.remove).to.exist;
    expect(playerInstance.remove).to.be.an("function");


  });

});
