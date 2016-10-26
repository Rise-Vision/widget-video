/* global config, _ */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFolder = function( data ) {
  "use strict";

  var _initialLoad = true,
    _files = [],
    utils = RiseVision.Common.Utilities,
    riseCache = RiseVision.Common.RiseCache;

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
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
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

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage." );
    } );

    storage.addEventListener( "rise-storage-empty-folder", function() {
      var params = { "event": "storage folder empty" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected folder does not contain any videos." );
    } );

    storage.addEventListener( "rise-storage-no-folder", function( e ) {
      var params = { "event": "storage folder doesn't exist", "event_details": e.detail };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected folder does not exist or has been moved to Trash." );
    } );

    storage.addEventListener( "rise-storage-folder-invalid", function() {
      var params = { "event": "storage folder format(s) invalid" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected folder does not contain any supported video formats." );
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

      RiseVision.Video.showError( errorMessage );
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "rise cache not running",
        "event_details": ( e.detail && e.detail.error ) ? e.detail.error.message : ""
      };

      RiseVision.Video.logEvent( params, true );
    } );

    storage.setAttribute( "fileType", "video" );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "folder", data.storage.folder );
    storage.setAttribute( "env", config.STORAGE_ENV );

    storage.go();
  }

  return {
    "init": init
  };
};
