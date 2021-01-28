/* global suiteSetup, suite, teardown, test, assert, RiseVision, sinon */

/* eslint-disable func-names */

var spy,
  storage,
  ready = false,
  isV2Running = false,
  table = "video_v2_events",
  params = {
    "event": "storage file not found",
    "file_url": "risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets/videos/a_food_show.webm",
    "file_format": "webm",
    "configuration": "storage file",
    /* eslint-disable quotes */
    "company_id": '"companyId"',
    "display_id": '"displayId"',
    /* eslint-enable quotes */
    "version": "1.1.0"
  },
  check = function( done ) {
    if ( ready ) {
      sinon.stub( RiseVision.Video, "play" );

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
  RiseVision.Common.LoggerUtils.logEvent.restore();
} );

suite( "configuration", function() {

  test( "should log the configuration event", function() {

    assert( spy.calledWith( table, {
      "event": "configuration",
      "event_details": params.configuration,
      "file_url": params.file_url,
      "file_format": params.file_format,
      "configuration": params.configuration,
      "company_id": params.company_id,
      "display_id": params.display_id,
      "version": params.version
    }, {
      severity: "info",
      eventApp: "widget-video",
      debugInfo: JSON.stringify( {
        "event": "configuration",
        "event_details": params.configuration,
        "file_url": params.file_url
      } )
    } ) );

  } );
} );

suite( "storage file not found", function() {
  test( "should log a storage file not found error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-no-file", {
      "detail": "/Fish_Tank_Project.webm",
      "bubbles": true
    } ) );

    params.event_details = "/Fish_Tank_Project.webm";
    delete params.file_url;
    delete params.file_format;

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000071",
      eventApp: "widget-video"
    } ) );
  } );
} );

suite( "rise storage error", function() {
  test( "should log a rise storage error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-error", {
      "detail": {
        "error": {
          "currentTarget": {
            "status": 0
          }
        }
      },
      "bubbles": true
    } ) );

    params.event = "rise storage error";
    params.event_details = "The request failed with status code: 0";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000075",
      eventApp: "widget-video"
    } ) );
  } );

  test( "should log a rise cache not running when ping response is empty", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    if ( isV2Running ) {
      storage.dispatchEvent( new CustomEvent( "rise-cache-not-running", {
        "detail": {
          "resp": null,
          "isPlayerRunning": true
        },
        "bubbles": true
      } ) );
    } else {
      storage.dispatchEvent( new CustomEvent( "rise-cache-not-running", null ) );
    }

    params.event = "rise cache not running";
    params.event_details = "no details";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000077",
      eventApp: "widget-video"
    } ) );
  } );

  test( "should log a rise cache not running when ping response is 404", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    if ( isV2Running ) {
      storage.dispatchEvent( new CustomEvent( "rise-cache-not-running", {
        "detail": {
          "resp": {
            "error": {
              "message": "The request failed with status code: 404"
            }
          },
          "isPlayerRunning": true
        },
        "bubbles": true
      } ) );
    } else {
      storage.dispatchEvent( new CustomEvent( "rise-cache-not-running", {
        "detail": {
          "error": {
            "message": "The request failed with status code: 404"
          }
        },
        "bubbles": true
      } ) );
    }

    params.event = "rise cache not running";
    params.event_details = "The request failed with status code: 404";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000077",
      eventApp: "widget-video"
    } ) );
  } );
} );

suite( "storage file throttled or no storage subscription", function() {
  test( "should log a storage file throttled error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-file-throttled", {
      "detail": window.gadget.settings.additionalParams.selector.url,
      "bubbles": true
    } ) );

    params.event = "storage file throttled";
    params.event_details = "no details";
    params.file_url = "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm";
    params.file_format = "webm";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000072",
      eventApp: "widget-video",
      debugInfo: JSON.stringify( { file_url: params.file_url } )
    } ) );
  } );
} );

suite( "storage subscription expired", function() {
  test( "should log a storage subscription expired error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-subscription-expired" ) );

    params.event = "storage subscription expired";
    delete params.file_url;
    delete params.file_format;

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000073",
      eventApp: "widget-video"
    } ) );
  } );

  test( "should log a storage subscription error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-subscription-error", {
      "detail": {
        "error": {
          "currentTarget": {
            "status": 0
          }
        }
      },
      "bubbles": true
    } ) );

    params.event = "storage subscription error";
    params.event_details = "The request failed with status code: 0";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000074",
      eventApp: "widget-video"
    } ) );
  } );
} );

suite( "storage api error", function() {
  test( "should log a storage api error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-api-error", {
      "detail": {
        "result": false,
        "code": 500,
        "message": "Could not retrieve Bucket Items"
      },
      "bubbles": true
    } ) );

    params.event = "storage api error";
    params.event_details = "Response code: 500, message: Could not retrieve Bucket Items";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params, {
      severity: "error",
      errorCode: "E000000070",
      eventApp: "widget-video"
    } ) );
  } );
} );
