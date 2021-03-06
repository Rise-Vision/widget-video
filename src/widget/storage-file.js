/* global config */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFile = function( data, displayId ) {
  "use strict";

  var _initialLoad = true,
    utils = RiseVision.Common.Utilities,
    videoUtils = RiseVision.VideoUtils;

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.getElementById( "videoStorage" ),
      self = this,
      viewerParams = utils.getViewerParams();

    if ( !storage ) {
      return;
    }

    if ( !storage.go ) {
      setTimeout( function() {
        self.init();
      }, 100 );

      console.log( "rise-storage component still not initialized; retrying" ); // eslint-disable-line no-console
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

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000013" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-no-file", function( e ) {
      var params = { "event": "storage file not found", "event_details": e.detail };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000014" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-file-throttled", function( e ) {
      var params = { "event": "storage file throttled", "event_details": "no details", "file_url": e.detail };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000015", debugInfo: JSON.stringify( { file_url: params.file_url } ) } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired", "event_details": "no details" };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000016" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000016" } );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000011" } );
      RiseVision.Video.handleError( true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var params = {
        "event": "rise cache error",
        "event_details": e.detail.error.message
      };

      // log the error
      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000019" } );

      // handle the error
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "rise cache not running",
        "event_details": "no details"
      };

      // only proceed to log and handle error if this is running on player with valid display id
      if ( !displayId || displayId === "preview" || displayId === "display_id" || displayId === "displayId" ) {
        return;
      }

      if ( e.detail ) {
        if ( e.detail.error && e.detail.error.message ) {
          // storage v1
          params.event_details = e.detail.error.message;
        } else if ( e.detail.resp && e.detail.resp.error && e.detail.resp.error.message ) {
          // storage v2
          params.event_details = e.detail.resp.error.message;
        }
      }

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000019" } );

      if ( e.detail && e.detail.isPlayerRunning ) {
        RiseVision.Video.handleError( true );
      }
    } );

    storage.addEventListener( "rise-cache-file-unavailable", function() {
      RiseVision.Video.onFileUnavailable( "File is downloading" );
    } );

    storage.setAttribute( "folder", data.storage.folder );
    storage.setAttribute( "fileName", data.storage.fileName );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "env", config.STORAGE_ENV );

    viewerParams && storage.setAttribute( "viewerEnv", viewerParams.viewer_env );
    viewerParams && storage.setAttribute( "viewerId", viewerParams.viewer_id );
    viewerParams && storage.setAttribute( "viewerType", viewerParams.viewer_type );

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
