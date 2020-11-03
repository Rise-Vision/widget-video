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
    assert( onFileInitSpy.calledWith( {
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      name: "a_food_show.webm",
      url: "file:///path/to/file/abc123"
    } ), "onFileInit() called with correct data" );
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
    assert( refreshSpy.calledWith( {
      filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
      name: "a_food_show.webm",
      url: "file:///path/to/file/def456"
    } ), "onFileRefresh() called with correct data" );
  } );
} );

suite( "file deleted", function() {
  var clock;

  setup( function() {
    clock = sinon.useFakeTimers();
    sinon.spy( RiseVision.VideoRLS, "onFileDeleted" );
    sinon.stub( RiseVision.VideoRLS, "play" );
  } );

  teardown( function() {
    RiseVision.VideoRLS.onFileDeleted.restore();
    RiseVision.VideoRLS.play.restore();
    clock.restore();
  } );

  test( "should dispose of the video player", function() {
    assert.isNotNull( document.querySelector( "video#player_html5_api" ), "video player is showing" );

    // mock receiving file-update to notify file is downloading
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "DELETED"
      } );
    } );

    clock.tick( 500 );

    assert.isNotNull( document.querySelector( "video#player" ), "video element is showing" );
    assert.isNull( document.querySelector( "video#player_html5_api" ), "video player is not showing" );

  } );
} );
