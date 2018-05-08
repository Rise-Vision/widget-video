/* global suiteSetup, suite, setup, teardown, test, assert,
 RiseVision, sinon */

/* eslint-disable func-names */

var ready = false,
  messageHandlers,
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

    assert.equal( document.querySelector( ".message" ).innerHTML, "There was a problem retrieving the file." );
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

  test( "file does not exist", function() {
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
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "NOEXIST"
      } );
    } );

    assert.equal( document.querySelector( ".message" ).innerHTML, "The selected video does not exist or has been moved to Trash." );
  } );

  test( "file error", function() {
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-error",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        msg: "File's host server could not be reached",
        detail: "error details"
      } );
    } );

    assert.equal( document.querySelector( ".message" ).innerHTML, "Unable to download the file." );
  } );

  test( "should call done and have Viewer call play function 5 seconds after an error", function() {
    var clock = sinon.useFakeTimers(),
      spy = sinon.spy( RiseVision.VideoRLS, "play" );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-error",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        msg: "File's host server could not be reached",
        detail: "error details"
      } );
    } );

    clock.tick( 4500 );
    assert( spy.notCalled );
    clock.tick( 500 );
    assert( spy.calledOnce );

    clock.restore();
    RiseVision.VideoRLS.play.restore();
  } );

} );

suite( "file deleted", function() {
  test( "file deleted", function() {
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

    // mock receiving file-update to notify file is deleted
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-update",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "deleted"
      } );
    } );

    console.log(document.getElementById( "container" ).style.visibility);

    assert.isTrue((document.getElementById("container").style.display === "block"), "video container is showing");
    assert.isTrue( ( document.getElementById( "messageContainer" ).style.display === "none" ), "message container is hidden" );
  } );
} );
