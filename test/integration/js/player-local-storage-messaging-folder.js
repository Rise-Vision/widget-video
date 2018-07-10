/* global suiteSetup, suite, setup, teardown, test, assert,
 RiseVision, sinon */

/* eslint-disable func-names */

var ready = false,
  folderPath = "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/",
  messageHandlers,
  clock,
  check = function( done ) {
    if ( ready ) {
      done();
    } else {
      setTimeout( function() {
        check( done )
      }, 1000 );
    }
  };

suiteSetup( function( done ) {
  check( done );
} );

suite( "waiting", function() {
  test( "should show waiting message", function() {
    assert.equal( document.querySelector( ".message" ).innerHTML, "Please wait while your video is downloaded.", "message is correct" );
  } );
} );

suite( "errors", function() {
  var clock;

  setup( function() {
    clock = sinon.useFakeTimers();
  } );

  teardown( function() {
    clock.restore();
  } );

  test( "required modules unavailable", function() {
    var i;

    function receiveClientList() {
      // mock receiving client-list message
      messageHandlers.forEach( function( handler ) {
        handler( {
          topic: "client-list",
          clients: [ "local-messaging" ]
        } );
      } );
    }

    // mock 30 more client-list messages sent/received
    for ( i = 30; i >= 0; i-- ) {
      receiveClientList();
      clock.tick( 1000 );
    }

    assert.equal( document.querySelector( ".message" ).innerHTML, "There was a problem retrieving the files." );
  } );

  test( "unauthorized", function() {
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
        isAuthorized: false,
        userFriendlyStatus: "unauthorized"
      } );
    } );

    assert.equal( document.querySelector( ".message" ).innerHTML, "Rise Storage subscription is not active." );
  } );

  test( "folder does not exist", function() {
    // mock receiving storage-licensing message
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "storage-licensing-update",
        isAuthorized: true,
        userFriendlyStatus: "authorized"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-update",
        filePath: folderPath,
        status: "NOEXIST"
      } );
    } );

    assert.equal( document.querySelector( ".message" ).innerHTML, "The selected folder does not exist or has been moved to Trash." );
  } );

  test( "folder is empty", function() {

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-update",
        filePath: folderPath,
        status: "EMPTYFOLDER"
      } );
    } );

    assert.equal( document.querySelector( ".message" ).innerHTML, "The selected folder does not contain any videos." );

  } );

} );

suite( "files downloading", function() {

  setup( function() {
    clock = sinon.useFakeTimers();
  } );

  teardown( function() {
    clock.restore();
  } );

  test( "should show message after 15 seconds of processing", function() {

    // files are getting processed, starts the initial processing timer
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: folderPath + "test-file.webm",
        status: "STALE"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: folderPath + "test-file-2.webm",
        status: "STALE"
      } );
    } );

    // expire initial processing timer
    clock.tick( 15000 );

    assert.equal( document.querySelector( ".message" ).innerHTML, "Files are downloading." );

  } );

} );

suite( "file error", function() {

  setup( function() {
    sinon.stub( RiseVision.VideoRLS, "onFileInit" );
    sinon.stub( RiseVision.VideoRLS, "onFileRefresh" );
    clock = sinon.useFakeTimers();
  } );

  teardown( function() {
    RiseVision.VideoRLS.onFileInit.restore();
    RiseVision.VideoRLS.onFileRefresh.restore();
    clock.restore();
  } );

  test( "should display message when all files in error", function() {
    var spy = sinon.spy( RiseVision.VideoRLS, "play" );

    // successfully initialize widget and clear messages
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: folderPath + "test-file.webm",
        status: "CURRENT",
        ospath: "path/to/file/abc123",
        osurl: "file:///path/to/file/abc123"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: folderPath + "test-file-2.webm",
        status: "CURRENT",
        ospath: "path/to/file/def456",
        osurl: "file:///path/to/file/def456"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-error",
        filePath: folderPath + "test-file.webm",
        msg: "File's host server could not be reached",
        detail: "error details"
      } );
    } );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-error",
        filePath: folderPath + "test-file-2.webm",
        msg: "File's host server could not be reached",
        detail: "error details"
      } );
    } );

    assert.equal( document.querySelector( ".message" ).innerHTML, "Unable to display any files." );

    clock.tick( 4500 );
    assert( spy.notCalled );
    clock.tick( 500 );
    assert( spy.calledOnce );

    RiseVision.VideoRLS.play.restore();
  } );

} );
