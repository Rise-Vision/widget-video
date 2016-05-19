"use strict";

describe("getVideoFileType()", function() {
  var utils = RiseVision.Video.PlayerUtils;

  it("should return correct HTML5 video file type calling getVideoFileType()", function () {
    var baseUrl = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest";

    expect(utils.getVideoFileType(baseUrl + ".webm")).to.equal("webm");
    expect(utils.getVideoFileType(baseUrl + ".mp4")).to.equal("mp4");
  });

  it("should return null as the HTML5 video file type calling getVideoFileType()", function () {
    var baseUrl = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest";

    expect(utils.getVideoFileType(baseUrl + ".flv")).to.be.null;
    expect(utils.getVideoFileType(baseUrl + ".mov")).to.be.null;
    expect(utils.getVideoFileType(baseUrl + ".avi")).to.be.null;
    expect(utils.getVideoFileType(baseUrl + ".mpg")).to.be.null;
    expect(utils.getVideoFileType(baseUrl + ".wmv")).to.be.null;
    expect(utils.getVideoFileType(baseUrl + ".ogg")).to.be.null;
    expect(utils.getVideoFileType(baseUrl + ".ogv")).to.be.null;
  });

});

describe("getPlaylist", function () {
  var utils = RiseVision.Video.PlayerUtils;
  
  it("should return a playlist with correctly formatted objects for JWPlayer", function () {
    var list = [
        "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest1.webm",
        "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest2.mp4",
        "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest3.webm"
      ],
      formats = ["webm", "mp4", "webm"],
      playlist = utils.getPlaylist(list);

    expect(playlist).to.be.an("array");
    expect(playlist).to.have.length(3);
    
    playlist.forEach(function (item, index) {
      expect(item).to.deep.equal({
        file: list[index],
        type: formats[index]
      });  
    });
    
  });
  
});
