/* global describe, it, expect, RiseVision */

/* eslint-disable func-names */

"use strict";

describe( "getVideoFileType()", function() {
  var utils = RiseVision.Video.PlayerUtils;

  it( "should return correct HTML5 video file type calling getVideoFileType()", function() {
    var baseUrl = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest";

    expect( utils.getVideoFileType( baseUrl + ".webm" ) ).to.equal( "video/webm" );
    expect( utils.getVideoFileType( baseUrl + ".mp4" ) ).to.equal( "video/mp4" );
  } );

  it( "should return null as the HTML5 video file type calling getVideoFileType()", function() {
    var baseUrl = "https://storage.googleapis.com/risemedialibrary-abc123/Widgets%2Ftest";

    expect( utils.getVideoFileType( baseUrl + ".flv" ) ).to.be.null;
    expect( utils.getVideoFileType( baseUrl + ".mov" ) ).to.be.null;
    expect( utils.getVideoFileType( baseUrl + ".avi" ) ).to.be.null;
    expect( utils.getVideoFileType( baseUrl + ".mpg" ) ).to.be.null;
    expect( utils.getVideoFileType( baseUrl + ".wmv" ) ).to.be.null;
    expect( utils.getVideoFileType( baseUrl + ".ogg" ) ).to.be.null;
    expect( utils.getVideoFileType( baseUrl + ".ogv" ) ).to.be.null;
  } );

} );
