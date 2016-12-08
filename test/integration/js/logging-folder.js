/* global requests, suiteSetup, suite, suiteTeardown, teardown, test, assert, RiseVision, sinon */

/* eslint-disable func-names */

var playStub,
  spy,
  clock,
  storage,
  ready = false,
  isV2Running = false,
  table = "video_v2_events",
  params = {
    "event": "storage folder empty",
    "file_url": null,
    /* eslint-disable quotes */
    "company_id": '"companyId"',
    "display_id": '"displayId"',
    /* eslint-enable quotes */
    "version": "2.0.0"
  },
  check = function( done ) {
    if ( ready ) {
      playStub = sinon.stub( RiseVision.Video, "play" );
      clock = sinon.useFakeTimers();

      done();
    } else {
      setTimeout( function() {
        check( done )
      }, 1000 );
    }
  };

suiteSetup( function( done ) {
  if ( isV2Running ) {
    requests[ 0 ].respond( 404 );
    requests[ 1 ].respond( 200 );
  }

  check( done );
} );

suiteTeardown( function() {
  playStub.restore();
  clock.restore();
} );

teardown( function() {
  RiseVision.Common.LoggerUtils.logEvent.restore();
} );

suite( "configuration", function() {

  test( "should log the configuration event", function() {

    assert( spy.calledWith( table, {
      "event": "configuration",
      "event_details": "storage folder",
      "file_url": params.file_url,
      "company_id": params.company_id,
      "display_id": params.display_id,
      "version": params.version
    } ) );

  } );
} );

suite( "storage folder empty", function() {
  test( "should log a storage folder empty error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-empty-folder", {
      "detail": null,
      "bubbles": true
    } ) );

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a storage folder empty error when done is fired", function() {
    storage.dispatchEvent( new CustomEvent( "rise-storage-empty-folder", {
      "detail": null,
      "bubbles": true
    } ) );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    clock.tick( 5000 );

    // storage folder empty + done
    assert( spy.calledTwice );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should not log a storage folder empty error when done is fired if the error has resolved itself on a refresh", function() {
    var file = "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm";

    storage.dispatchEvent( new CustomEvent( "rise-storage-empty-folder", {
      "detail": null,
      "bubbles": true
    } ) );

    // Resolve the error.
    RiseVision.Video.onFileRefresh( [ file ] );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    params.event = "done";

    clock.tick( 5000 );

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
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
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a rise storage error when done is fired", function() {
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

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    clock.tick( 5000 );

    // rise storage error + done
    assert( spy.calledTwice );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should not log a rise storage error when done is fired if the error has resolved itself on a refresh", function() {
    var file = "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm";

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

    // Resolve the error.
    RiseVision.Video.onFileRefresh( [ file ] );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    params.event = "done";
    // No event_details for a done event.
    delete params.event_details;

    clock.tick( 5000 );

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a rise cache error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-cache-error", {
      "detail": {
        "error": {
          "message": "The request failed with status code: 500"
        }
      },
      "bubbles": true
    } ) );

    params.event = "rise cache error";
    params.event_details = "The request failed with status code: 500";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
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
    params.event_details = "";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
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
    assert( spy.calledWith( table, params ) );
  } );
} );

suite( "storage folder doesn't exist", function() {
  test( "should log a storage folder doesn't exist error", function() {
    var filePath = window.gadget.settings.additionalParams.storage.folder;

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-no-folder", {
      "detail": filePath,
      "bubbles": true
    } ) );


    params.event = "storage folder doesn't exist";
    params.event_details = filePath;

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a storage folder doesn't exist error when done is fired", function() {
    var filePath = window.gadget.settings.additionalParams.storage.folder;

    storage.dispatchEvent( new CustomEvent( "rise-storage-no-folder", {
      "detail": filePath,
      "bubbles": true
    } ) );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    clock.tick( 5000 );
    // storage folder doesn't exist + done
    assert( spy.calledTwice );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should not log a storage folder doesn't exist error when done is fired if the error has resolved itself on a refresh", function() {
    var file = "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm";

    storage.dispatchEvent( new CustomEvent( "rise-storage-no-folder", {
      "detail": null,
      "bubbles": true
    } ) );

    // Resolve the error.
    RiseVision.Video.onFileRefresh( [ file ] );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    delete params.event_details;
    params.event = "done";

    clock.tick( 5000 );

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );
} );

suite( "storage folder format(s) invalid", function() {
  test( "should log a storage folder format(s) invalid error", function() {
    var filePath = window.gadget.settings.additionalParams.storage.folder;

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-folder-invalid", {
      "detail": filePath,
      "bubbles": true
    } ) );

    params.event = "storage folder format(s) invalid";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a storage folder format(s) invalid error when done is fired", function() {
    var filePath = window.gadget.settings.additionalParams.storage.folder;

    storage.dispatchEvent( new CustomEvent( "rise-storage-folder-invalid", {
      "detail": filePath,
      "bubbles": true
    } ) );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    clock.tick( 5000 );
    // storage folder doesn't exist + done
    assert( spy.calledTwice );
    assert( spy.calledWith( table, params ) );
  } );

} );

suite( "storage subscription expired", function() {
  suiteSetup( function() {
    clock = sinon.useFakeTimers();
  } );

  suiteTeardown( function() {
    clock.restore();
  } );

  test( "should log a storage subscription expired error", function() {
    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    storage.dispatchEvent( new CustomEvent( "rise-storage-subscription-expired" ) );

    params.event = "storage subscription expired";

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
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
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a storage subscription expired error when done is fired", function() {
    storage.dispatchEvent( new CustomEvent( "rise-storage-subscription-expired" ) );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    clock.tick( 5000 );

    delete params.event_details;
    params.event = "storage subscription expired";

    // storage subscription expired + done
    assert( spy.calledTwice );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should not log a storage subscription expired error when done is fired if the error has resolved itself on a refresh", function() {

    var file = "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm";

    storage.dispatchEvent( new CustomEvent( "rise-storage-subscription-expired" ) );

    // Resolve the error.
    RiseVision.Video.onFileRefresh( [ file ] );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );

    delete params.event_details;
    params.event = "done";

    clock.tick( 5000 );

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );
} );

suite( "storage api error", function() {
  suiteSetup( function() {
    clock = sinon.useFakeTimers();
  } );

  suiteTeardown( function() {
    clock.restore();
  } );

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
    assert( spy.calledWith( table, params ) );
  } );

  test( "should log a storage api error error when done is fired", function() {

    storage.dispatchEvent( new CustomEvent( "rise-storage-api-error", {
      "detail": {
        "result": false,
        "code": 500,
        "message": "Could not retrieve Bucket Items"
      },
      "bubbles": true
    } ) );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    clock.tick( 5000 );
    // storage folder doesn't exist + done
    assert( spy.calledTwice );
    assert( spy.calledWith( table, params ) );
  } );

  test( "should not log a storage api error when done is fired if the error has resolved itself on a refresh", function() {
    var file = "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm";

    storage.dispatchEvent( new CustomEvent( "rise-storage-api-error", {
      "detail": {
        "result": false,
        "code": 500,
        "message": "Could not retrieve Bucket Items"
      },
      "bubbles": true
    } ) );

    // Resolve the error.
    RiseVision.Video.onFileRefresh( [ file ] );

    spy = sinon.spy( RiseVision.Common.LoggerUtils, "logEvent" );
    delete params.event_details;
    params.event = "done";

    clock.tick( 5000 );

    assert( spy.calledOnce );
    assert( spy.calledWith( table, params ) );
  } );
} );
