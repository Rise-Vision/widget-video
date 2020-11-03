/* global suiteSetup, suite, test, assert, RiseVision, sinon, setup, teardown */

/* eslint-disable func-names */

var ready = false,
  isV2Running = false, // eslint-disable-line
  storage,
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

suite( "normal storage response", function() {
  suiteSetup( function() {
    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "added": true,
        "name": "Widgets/videos/big_buck_bunny.webm",
        "url": "https://www.googleapis.com/storage/v1/b/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/o/Widgets%2Fvideos%2Fbig_buck_bunny.webm?alt=media"
      },
      "bubbles": true
    } ) );
  } );

  test( "should not show a message", function() {
    assert.isTrue( ( document.getElementById( "container" ).style.display === "block" ), "video container is showing" );
    assert.isTrue( ( document.getElementById( "messageContainer" ).style.display === "none" ), "message container is hidden" );
  } );
} );

suite( "cache file unavailable", function() {
  setup( function() {
    sinon.stub( RiseVision.Video, "play" );
  } )

  teardown( function() {
    RiseVision.Video.play.restore();
  } );

  test( "should show file unavailable message", function() {
    storage.dispatchEvent( new CustomEvent( "rise-cache-file-unavailable", {
      "detail": {
        "status": 202,
        "message": "File is downloading"
      },
      "bubbles": true
    } ) );

    assert.equal( document.querySelector( ".message" ).innerHTML, "File is downloading", "message text" );
    assert.isTrue( ( document.getElementById( "messageContainer" ).style.display === "block" ), "message visibility" );
  } );

  test( "should not display message and ensure image is visible when file becomes available", function() {

    // storage provides file
    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "changed": true,
        "name": "Widgets/videos/big_buck_bunny.webm",
        "url": "https://www.googleapis.com/storage/v1/b/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/o/Widgets%2Fvideos%2Fbig_buck_bunny.webm?alt=media"
      },
      "bubbles": true
    } ) );

    // video should be visible
    assert.isTrue( ( document.getElementById( "container" ).style.display === "block" ), "video container is showing" );
    assert.isTrue( ( document.getElementById( "messageContainer" ).style.display === "none" ), "message container is hidden" );
  } );
} );
