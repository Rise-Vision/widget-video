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

suite( "file downloading", function() {
  var clock;

  setup( function() {
    clock = sinon.useFakeTimers();
    sinon.stub( RiseVision.VideoWatch, "play" );
  } );

  teardown( function() {
    clock.restore();
    RiseVision.VideoWatch.play.restore();
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


    // file is getting processed, starts the initial processing timer
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "FILE-UPDATE",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "STALE"
      } );
    } );

    // expire initial processing timer
    clock.tick( 15000 );

    assert.equal( document.querySelector( ".message" ).innerHTML, "File is downloading." );

  } );

} );

suite( "errors", function() {
  setup( function() {
    sinon.stub( RiseVision.VideoWatch, "play" );
  } );

  teardown( function() {
    RiseVision.VideoWatch.play.restore();
  } );

  test( "nothing is displayed", function() {
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-update",
        filePath: "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
        status: "NOEXIST"
      } );
    } );

    assert.isTrue( ( document.getElementById( "container" ).style.display === "none" ), "video container is hidden" );
    assert.isTrue( ( document.getElementById( "messageContainer" ).style.display === "block" ), "message container is visible" );
    assert.equal( document.querySelector( ".message" ).innerHTML, "", "message is empty" );
  } );
} );
