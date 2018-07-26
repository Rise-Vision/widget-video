/* global beforeEach, afterEach, describe, it, expect, sinon, RiseVision */

/* eslint-disable func-names */

"use strict";

describe( "getTableName", function() {
  it( "should return the correct table name", function() {
    expect( RiseVision.VideoUtils.getTableName(), "video_v2_events" );
  } );
} );

describe( "getStorageFileName", function() {
  it( "should provide file name from storage file path (bucket only)", function() {
    expect( RiseVision.VideoUtils.getStorageFileName( "risemedialibrary-abc123/test-file.jpg" ) ).to.equal( "test-file.jpg" );
  } );

  it( "should provide file name from storage file path (with subfolder)", function() {
    expect( RiseVision.VideoUtils.getStorageFileName( "risemedialibrary-abc123/test-folder/nested-folder/test-file.jpg" ) ).to.equal( "test-file.jpg" );
  } );
} );

describe( "logEvent", function() {
  var logSpy;

  beforeEach( function() {
    logSpy = sinon.spy( RiseVision.Common.Logger, "log" );
  } );

  afterEach( function() {
    RiseVision.Common.Logger.log.restore();
  } );

  it( "should call spy with correct parameters when all optional parameters are set", function() {
    var params = {
      "event": "test",
      "event_details": "test details",
      "file_url": "http://www.test.com/file.webm",
      "file_format": "webm",
      "configuration": "",
      "company_id": "",
      "display_id": ""
    };

    RiseVision.VideoUtils.logEvent( {
      "event": "test",
      "event_details": "test details",
      "file_url": "http://www.test.com/file.webm"
    } );

    expect( logSpy ).to.have.been.calledWith( "video_v2_events", params );
  } );

  it( "should call spy with correct parameters when only the event parameter is set", function() {
    var params = {
      "event": "test",
      "configuration": "",
      "company_id": "",
      "display_id": ""
    };

    RiseVision.VideoUtils.logEvent( { "event": "test" } );

    expect( logSpy ).to.have.been.calledWith( "video_v2_events", params );
  } );
} );
