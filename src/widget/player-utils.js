var RiseVision = RiseVision || {};

RiseVision.PlayerUtils = ( function() {
  "use strict";

  /*
   *  Public  Methods
   */
  function getVideoFileType( url ) {
    var extensions = [ ".mp4", ".webm" ],
      urlLowercase = url.toLowerCase(),
      type = null,
      i;

    for ( i = 0; i <= extensions.length; i += 1 ) {
      if ( urlLowercase.indexOf( extensions[ i ] ) !== -1 ) {
        type = "video/" + extensions[ i ].substr( extensions[ i ].lastIndexOf( "." ) + 1 );
        break;
      }
    }

    return type;
  }

  function getAspectRatio( width, height ) {

    var r;

    function gcd( a, b ) {
      return ( b == 0 ) ? a : gcd( b, a % b );
    }

    r = gcd( width, height );

    return width / r + ":" + height / r;
  }

  return {
    "getAspectRatio": getAspectRatio,
    "getVideoFileType": getVideoFileType
  };

} )();
