/* global suiteSetup, suiteTeardown, test, assert, RiseVision, sinon, config */

var xhr,
  requests,
  isV2Running = false;

sinon.stub( RiseVision.Common.RiseCache, "isV2Running", function( callback ) {
  xhr = sinon.useFakeXMLHttpRequest();
  requests = [];

  xhr.onCreate = function( xhr ) {
    requests.push( xhr );
  };

  sinon.stub( RiseVision.Video, "setAdditionalParams" );

  RiseVision.Common.RiseCache.isV2Running.restore();
  RiseVision.Common.RiseCache.isV2Running( callback );
} );

suiteSetup( function() {
  if ( !isV2Running ) {
    requests[ 0 ].respond( 200 );
  } else {
    requests[ 0 ].respond( 404 );
    requests[ 1 ].respond( 200 );
  }
} );

suiteTeardown( function() {
  xhr.restore();
  RiseVision.Video.setAdditionalParams.restore();
} );

test( "rise-storage element should be added to body", function() {
  assert.isNotNull( document.querySelector( "rise-storage" ) );
} );

test( "polyfill added to document head", function() {
  var head = document.getElementsByTagName( "head" )[ 0 ];

  assert.isNotNull( head.querySelector( "script[src='" + config.COMPONENTS_PATH + "webcomponentsjs/webcomponents-lite.min.js'" ) );
} );
