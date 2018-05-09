/* global requests, suiteSetup, suite, suiteTeardown, setup, teardown, test, assert,
  RiseVision, sinon, config */

/* eslint-disable func-names */

var ready = false,
  isV2Running = false,
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
  if ( isV2Running ) {
    requests[ 0 ].respond( 404 );
    requests[ 1 ].respond( 200 );
  }

  check( done );
} );

suite( "Storage Initialization - file added", function() {
  var onInitStub;

  suiteSetup( function() {
    onInitStub = sinon.stub( RiseVision.Video, "onFileInit" );
    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "added": true,
        "name": "Widgets/videos/a_food_show.webm",
        "url": "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fa_food_show.webm"
      },
      "bubbles": true
    } ) );
  } );

  suiteTeardown( function() {
    RiseVision.Video.onFileInit.restore();
  } );

  test( "should set folder attribute of storage component", function() {
    assert.equal( storage.folder, "Widgets/videos/" );
  } );

  test( "should set filename attribute of storage component", function() {
    assert.equal( storage.filename, "a_food_show.webm" );
  } );

  test( "should set companyid attribute of storage component", function() {
    assert.equal( storage.companyid, "b428b4e8-c8b9-41d5-8a10-b4193c789443" );
  } );

  test( "should set displayid attribute of storage component", function() {
    assert.equal( storage.displayid, "\"displayId\"" );
  } );

  test( "should set env attribute of storage component", function() {
    assert.equal( storage.env, config.STORAGE_ENV );
  } );

  test( "RiseVision.Video.onFileInit should be called", function() {
    assert( onInitStub.calledOnce );
  } );
} );

suite( "Storage Refresh - file changed", function() {

  test( "should call onFileRefresh() when file changed", function() {
    var onRefreshStub = sinon.stub( RiseVision.Video, "onFileRefresh", function() {} );

    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "changed": true,
        "url": "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fbig_buck_bunny.webm"
      },
      "bubbles": true
    } ) );

    assert( onRefreshStub.calledOnce );

    RiseVision.Video.onFileRefresh.restore();
  } );

} );

suite( "Storage Refresh - file unchanged", function() {

  test( "should not call onFileRefresh() when file has not changed", function() {
    var onRefreshStub = sinon.stub( RiseVision.Video, "onFileRefresh", function() {} );

    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "changed": false,
        "url": "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fbig_buck_bunny.webm"
      },
      "bubbles": true
    } ) );

    assert( onRefreshStub.notCalled );

    RiseVision.Video.onFileRefresh.restore();
  } );

} );

suite( "Storage Refresh - JW Player error", function() {

  test( "should refresh on a JW player error", function() {
    var onRefreshStub = sinon.stub( RiseVision.Video, "onFileRefresh", function() {} );

    RiseVision.Video.hasPlayerError = function() {
      return true;
    }

    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "changed": false,
        "url": "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fbig_buck_bunny.webm"
      },
      "bubbles": true
    } ) );

    assert( onRefreshStub.calledOnce );

    RiseVision.Video.onFileRefresh.restore();
  } );

} );

suite( "Storage Errors", function() {
  var params = { "event": "" },
    onShowErrorStub,
    onLogEventStub;

  setup( function() {
    onShowErrorStub = sinon.stub( RiseVision.Video, "showError", function() {} );
    onLogEventStub = sinon.stub( RiseVision.VideoUtils, "logEvent", function() {} );
  } );

  teardown( function() {
    delete params.url;
    delete params.event_details;

    RiseVision.Video.showError.restore();
    RiseVision.VideoUtils.logEvent.restore();
  } );

  test( "should handle when 'no file' error occurs", function() {
    var filePath = window.gadget.settings.additionalParams.storage.folder + "/" + window.gadget.settings.additionalParams.storage.fileName;

    params.event = "storage file not found";
    params.event_details = filePath;

    storage.dispatchEvent( new CustomEvent( "rise-storage-no-file", {
      "detail": filePath,
      "bubbles": true
    } ) );

    assert( onLogEventStub.calledOnce, "logEvent() called once" );
    assert( onLogEventStub.calledWith( params, true ), "logEvent() called with correct params" );
    assert( onShowErrorStub.calledOnce, "showError() called once" );
    assert( onShowErrorStub.calledWith( "The selected video does not exist or has been moved to Trash." ),
      "showError() called with correct message" );
  } );

  test( "should handle when 'file throttled' error occurs", function() {
    params.event = "storage file throttled";
    params.file_url = window.gadget.settings.additionalParams.url;

    storage.dispatchEvent( new CustomEvent( "rise-storage-file-throttled", {
      "detail": window.gadget.settings.additionalParams.url,
      "bubbles": true
    } ) );

    assert( onLogEventStub.calledOnce, "logEvent() called once" );
    assert( onLogEventStub.calledWith( params, true ), "logEvent() called with correct params" );
    assert( onShowErrorStub.calledOnce, "showError() called once" );
    assert( onShowErrorStub.calledWith( "The selected video is temporarily unavailable." ),
      "showError() called with correct message" );
  } );

  test( "should handle when 'storage api' error occurs", function() {
    params.event = "storage api error";
    params.event_details = "Response code: 500, message: Could not retrieve Bucket Items";
    delete params.file_url;

    storage.dispatchEvent( new CustomEvent( "rise-storage-api-error", {
      "detail": {
        "result": false,
        "code": 500,
        "message": "Could not retrieve Bucket Items"
      },
      "bubbles": true
    } ) );

    assert( onLogEventStub.calledOnce, "logEvent() called once" );
    assert( onLogEventStub.calledWith( params, true ), "logEvent() called with correct params" );
    assert( onShowErrorStub.calledOnce, "showError() called once" );
    assert( onShowErrorStub.calledWith( "Sorry, there was a problem communicating with Rise Storage." ),
      "showError() called with correct message" );
  } );

  test( "should handle when a rise storage error occurs", function() {
    params.event = "rise storage error";
    params.event_details = "The request failed with status code: 0";
    delete params.file_url;

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

    assert( onLogEventStub.calledOnce, "logEvent() called once" );
    assert( onLogEventStub.calledWith( params, true ), "logEvent() called with correct params" );
    assert( onShowErrorStub.calledOnce, "showError() called once" );
    assert( onShowErrorStub.calledWith( "Sorry, there was a problem communicating with Rise Storage." ),
      "showError() called with correct message" );
  } );

  test( "should handle when a rise cache error occurs", function() {
    params.event = "rise cache error";

    if ( isV2Running ) {
      params.event_details = "The request failed with status code: 502";

      storage.dispatchEvent( new CustomEvent( "rise-cache-error", {
        "detail": {
          "error": {
            "message": "The request failed with status code: 502"
          }
        },
        "bubbles": true
      } ) );

      assert( onShowErrorStub.calledWith( "There was a problem retrieving the file." ),
        "showError() called with correct message" );
    } else {
      params.event_details = "The request failed with status code: 500";

      storage.dispatchEvent( new CustomEvent( "rise-cache-error", {
        "detail": {
          "error": {
            "message": "The request failed with status code: 500"
          }
        },
        "bubbles": true
      } ) );

      assert( onShowErrorStub.calledWith( "There was a problem retrieving the file from Rise Cache." ),
        "showError() called with correct message" );
    }

    assert( onLogEventStub.calledOnce, "logEvent() called once" );
    assert( onLogEventStub.calledWith( params, true ), "logEvent() called with correct params" );
    assert( onShowErrorStub.calledOnce, "showError() called once" );
  } );

  test( "should handle when a 'rise cache not running' occurs", function() {
    params.event = "rise cache not running";
    params.event_details = "The request failed with status code: 404";

    delete params.file_url;

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

      assert( onShowErrorStub.calledOnce, "showError() called once" );
      assert( onShowErrorStub.calledWith( "Waiting for Rise Cache" ),
        "showError() called with correct message" );

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

    assert( onLogEventStub.calledOnce, "logEvent() called once" );
    assert( onLogEventStub.calledWith( params, true ), "logEvent() called with correct params" );

  } );

} );

suite( "Network Recovery", function() {

  test( "should call onFileRefresh() if in state of storage error and network recovered", function() {
    var onRefreshStub = sinon.stub( RiseVision.Video, "onFileRefresh", function() {} );

    // force a storage error in the scenario of a network failure
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

    // force a response in the scenario of the network recovered
    storage.dispatchEvent( new CustomEvent( "rise-storage-response", {
      "detail": {
        "changed": false,
        "url": "https://storage.googleapis.com/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/Widgets%2Fvideos%2Fbig_buck_bunny.webm"
      },
      "bubbles": true
    } ) );

    assert( onRefreshStub.calledOnce );

    RiseVision.Video.onFileRefresh.restore();
  } );

} );
