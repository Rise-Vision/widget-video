/* global suiteSetup, suite, test, assert, suiteTeardown,
 RiseVision, sinon */

/* eslint-disable func-names */

var receivedCounter = 0,
  receivedExpected = 0,
  callback = null,
  receivedHandler = function(event) {
    if ( event.data.topic.indexOf( "FILE-" ) !== -1 ) {
      receivedCounter += 1;

      if ( receivedCounter === receivedExpected ) {
        callback && callback();
      }
    }
  };

window.addEventListener( "message", function(evt) {
  receivedHandler(evt);
} );


suite( "files initialized", function() {
  var onFileInitSpy;

  suiteSetup( function( done ) {
    onFileInitSpy = sinon.stub( RiseVision.VideoWatch, "onFileInit" );

    receivedExpected = 4;

    callback = done;

    // mock receiving file-update to notify file is downloading
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm",
      status: "STALE"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
      status: "STALE"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm",
      status: "CURRENT"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
      status: "CURRENT"
    }, "*" );

  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileInit.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should be able to configure player with correct urls", function() {
    assert( onFileInitSpy.calledOnce, "onFileInit() called once" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ].length, 2, "intialized with 2 files" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ][ 0 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm", "file are sorted alphabetically ascending" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ][ 0 ].url, "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm", "file 1 url is correct" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ][ 1 ].url, "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm", "file 2 url is correct" );
  } );
} );

suite( "file added", function() {
  var onFileRefreshStub;

  suiteSetup( function( done ) {

    onFileRefreshStub = sinon.stub( RiseVision.VideoWatch, "onFileRefresh" );

    receivedExpected = 2;

    callback = done;

    // mock receiving file-update to notify a new file is available in this watched folder
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
      status: "STALE"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
      status: "CURRENT"
    }, "*" );

  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileRefresh.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should be able to configure player with an additional video", function() {
    assert( onFileRefreshStub.calledOnce, "onFileRefresh() called once" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 3, "refreshed with 3 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm", "file are sorted alphabetically ascending" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].url, "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm", "file url is correct" );
  } );
} );

suite( "file updated", function() {
  var onFileRefreshStub;

  suiteSetup( function( done ) {

    onFileRefreshStub = sinon.stub( RiseVision.VideoWatch, "onFileRefresh" );

    receivedExpected = 2;
    callback = done;

    // mock receiving file-update to notify a new file is available in this watched folder
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
      status: "STALE"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
      status: "CURRENT"
    }, "*" );

  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileRefresh.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should be able to configure player with an updated video", function() {
    assert( onFileRefreshStub.calledOnce, "onFileRefresh() called once" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 3, "refreshed with 3 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 0 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm", "files remain sorted alphabetically ascending" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 0 ].url, "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm", "updated file url is correct" );
  } );
} );

suite( "file deleted", function() {
  var onFileRefreshStub;

  suiteSetup( function( done ) {

    onFileRefreshStub = sinon.stub( RiseVision.VideoWatch, "onFileRefresh" );

    receivedExpected = 1;
    callback = done;

    // mock receiving file-update to notify a new file is available in this watched folder
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
      status: "DELETED"
    }, "*" );

  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileRefresh.restore();
    receivedCounter = 0;
    receivedExpected = 0;
    callback = null;
  } );

  test( "should be able to configure player after a video was deleted", function() {
    assert( onFileRefreshStub.calledOnce, "onFileRefresh() called once" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 2, "refreshed with 2 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm", "files remain sorted alphabetically ascending" );
  } );
} );

suite( "file error from update", function() {
  var onFileRefreshStub;

  suiteSetup( function( done ) {

    onFileRefreshStub = sinon.stub( RiseVision.VideoWatch, "onFileRefresh" );

    receivedExpected = 2;
    callback = done;

    // mock adding this file
    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
      status: "STALE"
    }, "*" );

    window.postMessage( {
      topic: "FILE-UPDATE",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
      status: "CURRENT"
    }, "*" );

  } );

  suiteTeardown( function() {
    RiseVision.VideoWatch.onFileRefresh.restore();
  } );

  test( "should be able to configure player after file error received for one of the videos in list", function( done ) {
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 3, "refreshed with 3 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].url, "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm", "file 3 url is correct" );

    receivedCounter = 0;
    receivedExpected = 1;
    callback = function() {
      // file should be removed from list provided to onFileRefresh()
      setTimeout( function() {
        assert( onFileRefreshStub.calledTwice, "onFileRefresh() called twice" );
        assert.equal( onFileRefreshStub.args[ 1 ][ 0 ].length, 2, "refreshed with 2 files" );
        assert.equal( onFileRefreshStub.args[ 1 ][ 0 ][ 1 ].url, "https://widgets.risevision.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm", "file 2 url is correct" );
        done();
      }, 200 );
    };

    // mock FILE-ERROR for this image
    window.postMessage( {
      topic: "FILE-ERROR",
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
      msg: "Insufficient disk space"
    }, "*" );
  } );
} );
