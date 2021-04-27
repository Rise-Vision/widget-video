/* global suiteSetup, suite, test, assert, suiteTeardown,
 RiseVision, sinon */

/* eslint-disable func-names */

var receivedCounter = 0,
  receivedExpected = 0,
  callback = null,
  receivedHandler = function( event ) {
    if ( event.data.topic.indexOf( "FILE-" ) !== -1 ) {
      receivedCounter += 1;

      if ( receivedCounter === receivedExpected ) {
        callback && callback();
      }
    }
  };

window.addEventListener( "message", function( evt ) {
  receivedHandler( evt );
} );

suite( "file added", function() {
  var onFileInitSpy;

  suiteSetup( function( done ) {
    onFileInitSpy = sinon.spy( RiseVision.VideoWatch, "onFileInit" );

    receivedExpected = 2;
    callback = done;

    // mock receiving file-update to notify file is downloading
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      status: "STALE"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      status: "CURRENT"
    }, "*" );
  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileInit.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should be able to set single video with correct url", function() {
    assert( onFileInitSpy.calledOnce, "onFileInit() called once" );
    assert( onFileInitSpy.calledWith( {
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      name: "a_food_show.webm",
      url: "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm"
    } ), "onFileInit() called with correct data" );
  } );
} );

suite( "file changed", function() {
  var refreshSpy;

  suiteSetup( function( done ) {
    refreshSpy = sinon.spy( RiseVision.VideoWatch, "onFileRefresh" );

    receivedExpected = 2;
    callback = done;

    // mock receiving file-update to notify file is downloading
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      status: "STALE"
    }, "*" );

    // mock receiving file-update to notify file is available
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      status: "CURRENT"
    }, "*" );
  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileRefresh.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should be able to update single file url", function() {
    assert( refreshSpy.calledOnce );
    assert( refreshSpy.calledWith( {
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      name: "a_food_show.webm",
      url: "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm"
    } ), "onFileRefresh() called with correct data" );
  } );
} );

suite( "file deleted", function() {
  var clock;

  suiteSetup( function( done ) {
    clock = sinon.useFakeTimers();
    sinon.spy( RiseVision.VideoWatch, "onFileDeleted" );
    sinon.stub( RiseVision.VideoWatch, "play" );

    receivedExpected = 1;
    callback = done;

    // mock receiving file-update to notify file is downloading
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      status: "DELETED"
    }, "*" );
  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileDeleted.restore();
    RiseVision.VideoWatch.play.restore();
    clock.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should dispose of the video player", function() {
    clock.tick( 500 );

    assert.isNotNull( document.querySelector( "video#player" ), "video element is showing" );
    assert.isNull( document.querySelector( "video#player_html5_api" ), "video player is not showing" );

  } );
} );
