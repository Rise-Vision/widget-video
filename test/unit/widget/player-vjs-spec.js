/* global describe, before, after, it, expect, sinon, RiseVision */
/* exported videojs */

/* eslint-disable func-names */

"use strict";

var videoJSObj =
  {
    src: function() {},
    options: function() {},
    pause: function() {},
    paused: function() {},
    play: function() {},
    remainingTime: function() {},
    currentTime: function() {},
    on: function() {}
  },
  videojs = function( tag, opts, cb ) {
    videoJSObj.options( opts );

    // execute the callback after returning instance
    setTimeout( function() {
      cb();
    }, 20 );

    return videoJSObj;
  };

videojs.options = { children: [] };

describe( "init()", function() {
  var params =
    {
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
      "https://test.com/test%2Fvideos%2Fvideo1.webm"
    ],
    optionsSpy,
    srcSpy;

  before( function() {
    optionsSpy = sinon.spy( videoJSObj, "options" );
    srcSpy = sinon.spy( videoJSObj, "src" );
  } );

  after( function() {
    videoJSObj.options.restore();
    videoJSObj.src.restore();
  } );

  it( "should setup videojs with correct options and src value", function() {
    var player = new RiseVision.Video.PlayerVJS( params );

    player.init( files );

    expect( optionsSpy ).to.have.been.calledWith( {
      controls: true,
      fluid: true,
      height: params.height,
      width: params.width
    } );

    // delay for callback execution
    setTimeout( function() {
      expect( srcSpy ).to.have.been.calledWith( {
        type: "video/webm",
        src: "https://test.com/test%2Fvideos%2Fvideo1.webm"
      } );
    }, 30 );


  } );

} );
