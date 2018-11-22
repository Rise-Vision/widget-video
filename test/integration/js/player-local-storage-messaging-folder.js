/* global suiteSetup, suite, setup, teardown, test, assert, sinon */

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
} );

suite( "files downloading", function() {

  setup( function() {
    clock = sinon.useFakeTimers();
  } );

  teardown( function() {
    clock.restore();
  } );

  test( "should show message after 15 seconds of processing", function() {

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
