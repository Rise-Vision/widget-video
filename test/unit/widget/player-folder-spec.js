"use strict";

describe("configure()", function() {

  var urls;

  beforeEach(function () {
    urls = [
      "https://www.googleapis.com/storage/v1/b/risemedialibrary-abc123/o/Widgets%2Fvideos%2Ftest1.webm",
      "https://www.googleapis.com/storage/v1/b/risemedialibrary-abc123/o/Widgets%2Fvideos%2Ftest2.mp4"
    ];
  });

  afterEach(function () {
    player = null;
  });

  it("should correctly apply files value", function () {
    configure(urls);
    expect(files).to.equal(urls);
  });

  it("should create player object", function () {
    configure(urls);

    expect(player).to.exist;
    expect(player).to.be.an("object");
  });

  it("should add getCurrentIndex method to player", function () {
    configure(urls);

    expect(player.getCurrentIndex).to.exist;
    expect(player.getCurrentIndex).to.be.an("function");
  });

});

describe("getPlaylist()", function() {

  it("should return a playlist with correctly formatted objects for JWPlayer", function () {
    var list = [
        "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest1.webm",
        "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest2.webm",
        "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest3.webm"
      ],
      playlist = getPlaylist(list);

    expect(playlist).to.be.an("array");
    expect(playlist).to.have.length(3);
    expect(playlist[0]).to.deep.equal({
      sources: [{
        file: list[0],
        type: "webm"
      }]
    });
  });

});

describe("getPlaybackData()", function() {

  var params, urls, skin;

  beforeEach(function () {
    params = {width: 1024, height: 768, video: {scaleToFit: true, volume: 50, controls: true, autoplay: true, pause: 10}};

    urls = [
      "https://www.googleapis.com/storage/v1/b/risemedialibrary-abc123/o/Widgets%2Fvideos%2Ftest1.webm",
      "https://www.googleapis.com/storage/v1/b/risemedialibrary-abc123/o/Widgets%2Fvideos%2Ftest2.mp4"
    ];

    skin = "";
  });

  it("should return an object with correct properties", function () {
    init(params, urls, skin);

    sinon.stub(player, "getDuration", function () {});
    sinon.stub(player, "getPosition", function () {});
    sinon.stub(player, "getCurrentIndex", function () {});

    expect(getPlaybackData()).to.include.keys("duration", "position", "total", "index");

    player.getDuration.restore();
    player.getPosition.restore();
    player.getCurrentIndex.restore();
  });

});
