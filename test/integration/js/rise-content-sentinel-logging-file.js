/* global suiteSetup, suite, test, assert, logSpy,
 RiseVision, sinon */

/* eslint-disable func-names */

var table = "video_v2_events",
  params = {
    "event": "error",
    "event_details": "",
    "file_url": "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
    "file_format": "webm",
    "configuration": "storage file (sentinel)",
    "company_id": "\"companyId\"",
    "display_id": "\"displayId\"",
    "version": "1.1.0"
  },
  receivedCounter = 0,
  receivedExpected = 0,
  callback = null,
  receivedHandler = function( event ) {
    if ( event.data.topic.indexOf( "FILE-" ) !== -1 ) {
      receivedCounter += 1;

      if ( receivedCounter === receivedExpected ) {
        callback && callback();
      }
    }
  };

window.addEventListener( "message", function( evt ) {
  receivedHandler( evt );
} );

suite( "errors", function() {

  suiteSetup( function( done ) {
    sinon.stub( RiseVision.VideoWatch, "play" );

    receivedExpected = 2;
    callback = done;

    window.postMessage( {
      topic: "FILE-ERROR",
      filePath: params.file_url,
      msg: "File's host server could not be reached",
      detail: "error details"
    }, "*" );

    window.postMessage( {
      topic: "FILE-ERROR",
      filePath: params.file_url,
      msg: "File's host server could not be reached",
      detail: "error details"
    }, "*" );
  } )

  test( "file error", function() {
    params.event = "error";
    params.event_details = "File's host server could not be reached | error details";

    // configuration event and one error event
    assert.equal( logSpy.callCount, 2 );
    assert( logSpy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000215",
      eventApp: "widget-video",
      debugInfo: JSON.stringify( {
        "watchType": "rise-content-sentinel",
        "file_url": params.file_url
      } )
    } ) );
  } );
} );
