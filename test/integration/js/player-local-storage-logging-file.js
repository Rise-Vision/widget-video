/* global suiteSetup, suite, setup, teardown, test, assert,
 RiseVision, sinon */

/* eslint-disable func-names */

var table = "video_v2_events",
  params = {
    "event": "error",
    "event_details": "",
    "file_url": "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
    "file_format": "webm",
    "company_id": "\"companyId\"",
    "display_id": "\"displayId\"",
    "version": "2.1.0"
  },
  ready = false,
  messageHandlers,
  logSpy,
  check = function( done ) {
    if ( ready ) {
      sinon.stub( RiseVision.VideoRLS, "play" );
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

teardown( function() {
  logSpy.restore();
} );

suite( "configuration", function() {

  test( "should log the configuration event", function() {

    console.log(logSpy.args);

    assert( logSpy.calledWith( table, {
      "event": "configuration",
      "event_details": "storage file",
      "file_url": null,
      "company_id": params.company_id,
      "display_id": params.display_id,
      "version": params.version
    } ) );

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

    logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    // mock 30 more client-list messages sent/received
    for ( i = 30; i >= 0; i-- ) {
      receiveClientList();
      clock.tick( 1000 );
    }

    params.event_details = "required modules unavailable";

    assert( logSpy.calledOnce );
    assert( logSpy.calledWith( table, params ) );
  } );

  test( "licensing unavailable", function() {
    logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    // mock receiving client-list message
    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "client-list",
        clients: [ "local-storage", "licensing" ]
      } );
    } );

    clock.tick( 33000 );

    params.event_details = "licensing unavailable";

    assert( logSpy.calledOnce );
    assert( logSpy.calledWith( table, params ) );
  } );

  test( "unauthorized", function() {
    logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

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

    params.event_details = "unauthorized";

    assert( logSpy.calledOnce );
    assert( logSpy.calledWith( table, params ) );

  } );

  test( "file does not exist", function() {
    logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

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
        filePath: params.file_url,
        status: "NOEXIST"
      } );
    } );

    params.event_details = "file does not exist";

    assert( logSpy.calledOnce );
    assert( logSpy.calledWith( table, params ) );

  } );

  test( "file error", function() {
    logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-error",
        filePath: params.file_url,
        msg: "File's host server could not be reached",
        detail: "error details"
      } );
    } );

    params.event_details = "File's host server could not be reached";
    params.error_details = "error details";

    assert( logSpy.calledOnce );
    assert( logSpy.calledWith( table, params ) );
  } );

  test( "file deleted", function() {
    logSpy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    messageHandlers.forEach( function( handler ) {
      handler( {
        topic: "file-update",
        filePath: params.file_url,
        status: "deleted"
      } );
    } );

    params.event = "file deleted";
    delete params.event_details;
    delete params.error_details;

    assert( logSpy.calledOnce );
    assert( logSpy.calledWith( table, params ) );
  } );

} );