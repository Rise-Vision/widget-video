/* global config */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFile = function( data, displayId ) {
  "use strict";

  var _initialLoad = true,
    utils = RiseVision.Common.Utilities,
    riseCache = RiseVision.Common.RiseCache;

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
      return;
    }

    storage.addEventListener( "rise-storage-response", function( e ) {
      if ( e.detail && e.detail.url ) {

        if ( _initialLoad ) {
          _initialLoad = false;

          RiseVision.Video.onFileInit( e.detail.url );
        } else {
          // check for "changed" property
          if ( e.detail.hasOwnProperty( "changed" ) ) {
            if ( e.detail.changed ) {
              RiseVision.Video.onFileRefresh( e.detail.url );
            } else {
              // in the event of a network failure and recovery, check if the Widget is in a state of storage error
              if ( RiseVision.Video.hasStorageError() || RiseVision.Video.hasPlayerError() ) {
                // proceed with refresh logic so the Widget can eventually play video again from a network recovery
                RiseVision.Video.onFileRefresh( e.detail.url );
              }
            }
          }
        }
      }
    } );

    storage.addEventListener( "rise-storage-api-error", function( e ) {
      var params = {
        "event": "storage api error",
        "event_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage." );
    } );

    storage.addEventListener( "rise-storage-no-file", function( e ) {
      var params = { "event": "storage file not found", "event_details": e.detail };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected video does not exist or has been moved to Trash." );
    } );

    storage.addEventListener( "rise-storage-file-throttled", function( e ) {
      var params = { "event": "storage file throttled", "file_url": e.detail };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected video is temporarily unavailable." );
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Rise Storage subscription is not active." );
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent( params, true );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage.", true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var params = {
          "event": "rise cache error",
          "event_details": e.detail.error.message
        },
        statusCode = 0,
        errorMessage;

      // log the error
      RiseVision.Video.logEvent( params, true );

      if ( riseCache.isV2Running() ) {
        errorMessage = riseCache.getErrorMessage( statusCode );
      } else {
        // Show a different message if there is a 404 coming from rise cache
        if ( e.detail.error.message ) {
          statusCode = +e.detail.error.message.substring( e.detail.error.message.indexOf( ":" ) + 2 );
        }

        errorMessage = utils.getRiseCacheErrorMessage( statusCode );
      }

      // show the error
      RiseVision.Video.showError( errorMessage );
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "rise cache not running",
        "event_details": ( e.detail && e.detail.error ) ? e.detail.error.message : ""
      };

      RiseVision.Video.logEvent( params, true );
    } );

    storage.addEventListener( "rise-cache-file-unavailable", function() {
      RiseVision.Video.onFileUnavailable( "File is downloading" );
    } );

    storage.setAttribute( "folder", data.storage.folder );
    storage.setAttribute( "fileName", data.storage.fileName );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "env", config.STORAGE_ENV );

    storage.go();
  }

  function retry() {
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
      return;
    }

    storage.go();
  }

  return {
    "init": init,
    "retry": retry
  };
};
