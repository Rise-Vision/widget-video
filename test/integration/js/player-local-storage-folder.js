/* global suiteSetup, suite, test, assert, suiteTeardown,
 RiseVision, sinon */

/* eslint-disable func-names */

var messageHandlers;

suite( "files initialized", function() {
  var onFileInitSpy;

  suiteSetup( function() {
    onFileInitSpy = sinon.stub( RiseVision.VideoRLS, "onFileInit" );

    // mock receiving client-list message
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "client-list",
        clients: [ "local-storage", "licensing" ]
      } );
    } );

    // mock receiving storage-licensing message
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "storage-licensing-update",
        isAuthorized: true,
        userFriendlyStatus: "authorized"
      } );
    } );

    // mock receiving file-update to notify files are downloading
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm",
        status: "STALE"
      } );

      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
        status: "STALE"
      } );
    } );


    // mock receiving file-update to notify files are available
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm",
        status: "CURRENT",
        ospath: "path/to/file/def456",
        osurl: "file:///path/to/file/def456"
      } );

      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
        status: "CURRENT",
        ospath: "path/to/file/abc123",
        osurl: "file:///path/to/file/abc123"
      } );
    } );

  } );

  suiteTeardown( function() {
    RiseVision.VideoRLS.onFileInit.restore();
  } );

  test( "should be able to configure player with correct urls", function() {
    assert( onFileInitSpy.calledOnce, "onFileInit() called once" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ].length, 2, "intialized with 2 files" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ][ 0 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm", "file are sorted alphabetically ascending" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ][ 0 ].url, "file:///path/to/file/abc123", "file 1 url is correct" );
    assert.equal( onFileInitSpy.args[ 0 ][ 0 ][ 1 ].url, "file:///path/to/file/def456", "file 2 url is correct" );
  } );
} );

suite( "file added", function() {
  var onFileRefreshStub;

  suiteSetup( function() {

    onFileRefreshStub = sinon.stub( RiseVision.VideoRLS, "onFileRefresh" );

    // mock receiving file-update to notify a new file is available in this watched folder
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
        status: "STALE"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
        status: "CURRENT",
        ospath: "path/to/file/ghi789",
        osurl: "file:///path/to/file/ghi789"
      } );
    } );

  } );

  suiteTeardown( function() {
    RiseVision.VideoRLS.onFileRefresh.restore();
  } );

  test( "should be able to configure player with an additional video", function() {
    assert( onFileRefreshStub.calledOnce, "onFileRefresh() called once" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 3, "refreshed with 3 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm", "file are sorted alphabetically ascending" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].url, "file:///path/to/file/ghi789", "file 3 url is correct" );
  } );
} );

suite( "file updated", function() {
  var onFileRefreshStub;

  suiteSetup( function() {

    onFileRefreshStub = sinon.stub( RiseVision.VideoRLS, "onFileRefresh" );

    // mock receiving file-update to notify a new file is available in this watched folder
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
        status: "STALE"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm",
        status: "CURRENT",
        ospath: "path/to/file/cba321",
        osurl: "file:///path/to/file/cba321"
      } );
    } );

  } );

  suiteTeardown( function() {
    RiseVision.VideoRLS.onFileRefresh.restore();
  } );

  test( "should be able to configure player with an updated video", function() {
    assert( onFileRefreshStub.calledOnce, "onFileRefresh() called once" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 3, "refreshed with 3 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 0 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-a.webm", "files remain sorted alphabetically ascending" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 0 ].url, "file:///path/to/file/cba321", "updated file url is correct" );
  } );
} );

suite( "file deleted", function() {
  var onFileRefreshStub;

  suiteSetup( function() {

    onFileRefreshStub = sinon.stub( RiseVision.VideoRLS, "onFileRefresh" );

    // mock receiving file-update to notify a new file is available in this watched folder
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
        status: "DELETED"
      } );
    } );

  } );

  suiteTeardown( function() {
    RiseVision.VideoRLS.onFileRefresh.restore();
  } );

  test( "should be able to configure player after a video was deleted", function() {
    assert( onFileRefreshStub.calledOnce, "onFileRefresh() called once" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 2, "refreshed with 2 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].filePath, "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-c.webm", "files remain sorted alphabetically ascending" );
  } );
} );

suite( "file error from update", function() {
  var onFileRefreshStub;

  suiteSetup( function() {

    onFileRefreshStub = sinon.stub( RiseVision.VideoRLS, "onFileRefresh" );

    // mock adding this file
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
        status: "STALE"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
        status: "CURRENT",
        ospath: "path/to/file/ghi789",
        osurl: "file:///path/to/file/ghi789"
      } );
    } );

  } );

  suiteTeardown( function() {
    RiseVision.VideoRLS.onFileRefresh.restore();
  } );

  test( "should be able to configure player after file error received for one of the videos in list", function() {
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ].length, 3, "refreshed with 3 files" );
    assert.equal( onFileRefreshStub.args[ 0 ][ 0 ][ 1 ].url, "file:///path/to/file/ghi789", "file 3 url is correct" );

    // mock FILE-ERROR for this image
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-ERROR",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/test-file-b.webm",
        msg: "Insufficient disk space"
      } );
    } );

    // file should be removed from list provided to onFileRefresh()
    assert( onFileRefreshStub.calledTwice, "onFileRefresh() called twice" );
    assert.equal( onFileRefreshStub.args[ 1 ][ 0 ].length, 2, "refreshed with 2 files" );
    assert.equal( onFileRefreshStub.args[ 1 ][ 0 ][ 1 ].url, "file:///path/to/file/def456", "file 2 url is correct" );
  } );
} );
