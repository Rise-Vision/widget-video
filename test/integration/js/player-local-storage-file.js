/* global suiteSetup, suite, setup, teardown, test, assert, suiteTeardown,
 RiseVision, sinon */

/* eslint-disable func-names */

var messageHandlers;

suite( "file added", function() {
  var onFileInitSpy;

  suiteSetup( function() {
    onFileInitSpy = sinon.spy( RiseVision.VideoRLS, "onFileInit" );

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

    // mock receiving file-update to notify file is downloading
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "STALE"
      } );
    } );

    // mock receiving file-update to notify file is available
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "CURRENT",
        ospath: "path/to/file/abc123",
        osurl: "file:///path/to/file/abc123"
      } );
    } );
  } );

  suiteTeardown( function() {
    RiseVision.VideoRLS.onFileInit.restore();
  } );

  test( "should be able to set single video with correct url", function() {
    assert( onFileInitSpy.calledOnce, "onFileInit() called once" );
    assert( onFileInitSpy.calledWith( "file:///path/to/file/abc123" ), "onFileInit() called with correct url" );
  } );
} );

suite( "file changed", function() {
  var refreshSpy;

  setup( function() {
    refreshSpy = sinon.spy( RiseVision.VideoRLS, "onFileRefresh" );
  } );

  teardown( function() {
    RiseVision.VideoRLS.onFileRefresh.restore();
  } );

  test( "should be able to update single file url", function() {
    // mock receiving file-update to notify file is downloading
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "STALE"
      } );
    } );

    // mock receiving file-update to notify file is available
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "CURRENT",
        ospath: "path/to/file/def456",
        osurl: "file:///path/to/file/def456"
      } );
    } );

    assert( refreshSpy.calledOnce );
    assert( refreshSpy.calledWith( "file:///path/to/file/def456" ), "onFileRefresh() called with correct url" );
  } );
} );
