/* global suiteSetup, suite, setup, teardown, test, assert,
 RiseVision, sinon */

/* eslint-disable func-names */

var table = "video_v2_events",
  params = {
    "event": "error",
    "event_details": "",
    "file_url": "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/",
    "file_format": "unknown",
    "configuration": "storage folder (sentinel)",
    "company_id": "\"companyId\"",
    "display_id": "\"displayId\"",
    "version": "1.1.0"
  },
  receivedCounter = 0,
  receivedExpected = 0,
  callback = null,
  receivedHandler = function(event) {
    if ( event.data.topic.indexOf( "FILE-" ) !== -1 ) {
      receivedCounter += 1;

      if ( receivedCounter === receivedExpected ) {
        callback && callback();
      }
    }
  };

window.addEventListener( "message", function(evt) {
  receivedHandler(evt);
} );

teardown( function() {
  logSpy.restore();
} );

suite( "errors", function() {

  suiteSetup(function(done) {
    sinon.stub( RiseVision.VideoWatch, "play" );

    receivedExpected = 1;
    callback = done;

    console.log("posting message")

    window.postMessage( {
      topic: "FILE-ERROR",
      filePath: params.file_url + "test-file-in-error.webm",
      msg: "Could not retrieve signed URL",
      detail: "error details"
    }, "*" );
  })

  test( "file error", function() {
    var logParams;

    logParams = JSON.parse( JSON.stringify( params ) );
    logParams.file_url = params.file_url + "test-file-in-error.webm";
    logParams.file_format = "webm";
    logParams.event = "error";
    logParams.event_details = "Could not retrieve signed URL | error details";

    assert( logSpy.calledTwice ); // once for configuration event and once for error
    assert( logSpy.calledWith( table, logParams, {
      severity: "error",
      errorCode: "E000000215",
      eventApp: "widget-video",
      debugInfo: JSON.stringify( {
        "watchType": "rise-content-sentinel",
        "file_url": logParams.file_url
      } )
    } ) );
  } );
} );
