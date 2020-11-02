/* global suiteSetup, suite, setup, teardown, test, assert, sinon, RiseVision */

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

suite( "files downloading", function() {

  setup( function() {
    clock = sinon.useFakeTimers();
    sinon.stub( RiseVision.VideoRLS, "play" );
  } );

  teardown( function() {
    clock.restore();
    RiseVision.VideoRLS.play.restore();
  } );

  test( "should show message after 15 seconds of processing", function() {

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

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-update",
        filePath: folderPath,
        status: "NOEXIST"
      } );
    } );

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

suite( "errors", function() {
  setup( function() {
    clock = sinon.useFakeTimers();
    sinon.stub( RiseVision.VideoRLS, "play" );
  } );

  teardown( function() {
    clock.restore();
    RiseVision.VideoRLS.play.restore();
  } );

  test( "nothing is displayed", function() {
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: folderPath,
        status: "EMPTYFOLDER"
      } );
    } );

    assert.isTrue( ( document.getElementById( "container" ).style.display === "none" ), "video container is hidden" );
    assert.isTrue( ( document.getElementById( "messageContainer" ).style.display === "block" ), "message container is visible" );
    assert.equal( document.querySelector( ".message" ).innerHTML, "", "message is empty" );
  } );
} );
