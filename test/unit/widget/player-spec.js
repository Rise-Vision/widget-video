"use strict";

var jwplayerObj = {
  getState: function () {},
  load: function (playlist) {},
  pause: function () {},
  play: function () {},
  playlistItem: function (index) {},
  off: function (eventName) {},
  on: function (eventName) {},
  seek: function (value) {},
  setup: function (data) {},
  setVolume: function (value) {}
};

var jwplayer = function() {
  return jwplayerObj;
};

describe("init()", function() {
  var params = {
    "video": {
      "scaleToFit": true,
      "volume": 50,
      "controls": true,
      "autoplay": true,
      "resume": true,
      "pause": 5
    },
    "width": 1200,
    "height": 800
  },
    files = [
      "https://test.com/test%2Fvideos%2Fvideo1.webm",
      "https://test.com/test%2Fvideos%2Fvideo2.mp4"
    ],
    playlist = [
      {
        file: files[0],
        type: "webm"
      },
      {
        file: files[1],
        type: "mp4"
      }
    ],
    setupSpy;

  beforeEach(function () {
    setupSpy = sinon.spy(jwplayerObj, "setup");
  });

  afterEach(function() {
    jwplayerObj.setup.restore();
  });

  it("should call setup jwplayer with correct configuration", function () {
    var player = new RiseVision.Video.Player(params);
    player.init(files);

    expect(setupSpy).to.have.been.calledWith({
      controls: params.video.controls,
      height: params.height,
      playlist: playlist,
      skin: {name: "rise"},
      stretching : "uniform",
      width: params.width
    });
  });

});
