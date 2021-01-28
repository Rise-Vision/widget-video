/* global config, _ */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFolder = function( data, displayId ) {
  "use strict";

  var _initialLoad = true,
    _files = [],
    utils = RiseVision.Common.Utilities,
    videoUtils = RiseVision.VideoUtils;

  function _getUrls() {
    return _.pluck( _files, "url" );
  }

  function _getExistingFile( file ) {
    return _.find( _files, function( f ) {
      return file.name === f.name;
    } );
  }

  function _deleteFile( file ) {
    var existing = _getExistingFile( file );

    if ( existing ) {
      _files.splice( _files.indexOf( existing ), 1 );
    }
  }

  function _changeFile( file ) {
    var existing = _getExistingFile( file );

    if ( existing ) {
      existing.url = file.url;
    }
  }

  function _addFile( file ) {
    var existing = _getExistingFile( file );

    if ( !existing ) {
      // extract the actual file name and store in new property on file object
      file.fileName = file.name.slice( file.name.lastIndexOf( "/" ) + 1, file.name.lastIndexOf( "." ) ).toLowerCase();

      // insert file to _files list at specific index based on alphabetical order of file name
      _files.splice( _.sortedIndex( _files, file, "fileName" ), 0, file );
    }
  }

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
      var file = e.detail;

      // Added
      if ( file.added ) {
        _addFile( file );

        if ( _initialLoad ) {
          _initialLoad = false;
          RiseVision.Video.onFileInit( _getUrls() );

          return;
        }
      }

      // Changed or unchanged
      if ( file.hasOwnProperty( "changed" ) ) {
        if ( file.changed ) {
          _changeFile( file );
        } else {
          // in the event of a network failure and recovery, check if the Widget is in a state of storage error
          if ( !RiseVision.Video.hasStorageError() && !RiseVision.Video.hasPlayerError() ) {
            // only proceed with refresh logic below if there's been a storage error, otherwise do nothing
            // this is so the Widget can eventually play video again from a network recovery
            return;
          }
        }
      }

      // Deleted
      if ( file.deleted ) {
        _deleteFile( file );
      }

      RiseVision.Video.onFileRefresh( _getUrls() );

    } );

    storage.addEventListener( "rise-storage-api-error", function( e ) {
      var params = {
        "event": "storage api error",
        "event_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000070" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-empty-folder", function() {
      var params = { "event": "storage folder empty", "event_details": "no details" };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000078" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-no-folder", function( e ) {
      var params = { "event": "storage folder doesn't exist", "event_details": e.detail };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000079" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-folder-invalid", function() {
      var params = { "event": "storage folder format(s) invalid", "event_details": "no details" };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000080" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired", "event_details": "no details" };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000073" } );
      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000074" } );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000075" } );
      RiseVision.Video.handleError( true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var params = {
        "event": "rise cache error",
        "event_details": e.detail.error.message
      };

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000076" } );

      RiseVision.Video.handleError();
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "rise cache not running",
        "event_details": "no details"
      };

      if ( e.detail ) {
        if ( e.detail.error ) {
          // storage v1
          params.event_details = e.detail.error.message;
        } else if ( e.detail.resp && e.detail.resp.error ) {
          // storage v2
          params.event_details = e.detail.resp.error.message;
        }
      }

      videoUtils.logEvent( params, { severity: "error", errorCode: "E000000077" } );

      if ( e.detail && e.detail.isPlayerRunning ) {
        RiseVision.Video.handleError( true );
      }
    } );

    storage.addEventListener( "rise-cache-folder-unavailable", function() {
      RiseVision.Video.onFileUnavailable( "Files are downloading" );
    } );

    storage.setAttribute( "fileType", "video" );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "folder", data.storage.folder );
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
