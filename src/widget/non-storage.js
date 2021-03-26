var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.NonStorage = function( data ) {
  "use strict";

  var riseCache = RiseVision.Common.RiseCache,
    utils = RiseVision.Common.Utilities,
    videoUtils = RiseVision.VideoUtils,
    // 15 minutes
    _refreshDuration = 900000,
    _refreshIntervalId = null,
    _isLoading = true,
    _url = "";

  function _getRiseErrorCode( statusCode ) {
    switch ( statusCode ) {
    case 502:
        // File's host server returned an invalid response
      return "E000000209";
    case 504:
        // File's host server could not be reached
      return "E000000207";
    case 507:
        // Insufficient disk space
      return "E000000040";
    case 534:
        // File not found on the host server
      return "E000000208";
    default:
        // 400 - Bad request, missing url parameter
        // 500 - File streaming error
        // 0 - Rise Cache not responding
        // Unexpected status
      return "E000000019";
    }
  }

  function _getFile( omitCacheBuster ) {
    riseCache.getFile( _url, function( response, error ) {
      var statusCode,
        errorMessage,
        riseErrorCode;

      if ( !error ) {

        if ( _isLoading ) {
          _isLoading = false;

          RiseVision.Video.onFileInit( response.url );

          // start the refresh interval
          _startRefreshInterval();

        } else {
          RiseVision.Video.onFileRefresh( response.url );
        }

      } else {

        errorMessage = error.message || null;

        if ( errorMessage === "File is downloading" ) {

          RiseVision.Video.onFileUnavailable( error.message );

        } else {
          // status code is provided in the error message, extract it
          statusCode = errorMessage ? +errorMessage.substring( errorMessage.indexOf( ":" ) + 2 ) : 0;
          riseErrorCode = _getRiseErrorCode( statusCode );

          videoUtils.logEvent( {
            "event": "non-storage error",
            "event_details": errorMessage,
            "file_url": response.url
          }, { severity: "error", errorCode: riseErrorCode, debugInfo: JSON.stringify( { file_url: response.url } ) } );

          // handle the error
          RiseVision.Video.handleError();
        }
      }
    }, omitCacheBuster );
  }

  function _startRefreshInterval() {
    if ( _refreshIntervalId === null ) {
      _refreshIntervalId = setInterval( function() {
        _getFile( false );
      }, _refreshDuration );
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    // Handle pre-merge use of "url" setting property
    _url = ( data.url && data.url !== "" ) ? data.url : data.selector.url;

    _url = utils.addProtocol( _url );

    _getFile( true );
  }

  function retry() {
    _getFile( false );
  }

  return {
    "init": init,
    "retry": retry
  };
};
