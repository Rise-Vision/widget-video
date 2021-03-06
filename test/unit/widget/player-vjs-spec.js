/* global describe, before, after, it, expect, sinon, RiseVision */
/* exported videojs */

/* eslint-disable func-names */

"use strict";

var loadSpinnerComponent,
  videoJSObj =
  {
    src: function() {},
    options: function() {},
    pause: function() {},
    paused: function() {},
    play: function() {},
    remainingTime: function() {},
    currentTime: function() {},
    on: function() {},
    getChild: function() {
      return loadSpinnerComponent
    },
    removeChild: function() {}
  },
  videojs = function( tag, opts, cb ) {
    videoJSObj.options( opts );

    // execute the callback after returning instance
    setTimeout( function() {
      cb();
    }, 20 );

    return videoJSObj;
  };

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
    getChildSpy,
    removeChildSpy,
    srcSpy;

  before( function() {
    optionsSpy = sinon.spy( videoJSObj, "options" );
    getChildSpy = sinon.spy( videoJSObj, "getChild" );
    removeChildSpy = sinon.spy( videoJSObj, "removeChild" );
    srcSpy = sinon.spy( videoJSObj, "src" );
  } );

  after( function() {
    videoJSObj.options.restore();
    videoJSObj.src.restore();
  } );

  it( "should setup videojs with correct options and src value", function() {
    var player = new RiseVision.PlayerVJS( params );

    player.init( files );

    expect( optionsSpy ).to.have.been.calledWith( {
      controls: true,
      fluid: false,
      height: params.height,
      width: params.width
    } );

    expect( getChildSpy ).to.have.been.calledWith( "loadingSpinner" );

    expect( removeChildSpy ).to.have.been.calledWith( loadSpinnerComponent );

    // delay for callback execution
    setTimeout( function() {
      expect( srcSpy ).to.have.been.calledWith( {
        type: "video/webm",
        src: "https://test.com/test%2Fvideos%2Fvideo1.webm"
      } );
    }, 30 );


  } );

} );
