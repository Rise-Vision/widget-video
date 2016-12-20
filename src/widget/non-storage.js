var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.NonStorage = function( data ) {
  "use strict";

  var riseCache = RiseVision.Common.RiseCache,
    utils = RiseVision.Common.Utilities,
    // 15 minutes
    _refreshDuration = 900000,
    _refreshIntervalId = null,
    _isLoading = true,
    _url = "";

  function _getFile( omitCacheBuster ) {
    riseCache.getFile( _url, function( response, error ) {
      var statusCode = 0,
        errorMessage;

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

        if ( error.message && error.message === "File is downloading" ) {

          RiseVision.Video.onFileUnavailable( error.message );

        } else {

          // error occurred
          RiseVision.Video.logEvent( {
            "event": "non-storage error",
            "event_details": error.message,
            "file_url": response.url
          }, true );

          riseCache.isV2Running( function showError( isV2 ) {
            if ( error.message ) {
              statusCode = +error.message.substring( error.message.indexOf( ":" ) + 2 );
            }

            if ( isV2 ) {
              errorMessage = riseCache.getErrorMessage( statusCode );
            // Show a different message if there is a 404 coming from rise cache
            } else {
              errorMessage = utils.getRiseCacheErrorMessage( statusCode );
            }

            // show the error
            RiseVision.Video.showError( errorMessage );
          } );
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

  return {
    "init": init
  };
};
