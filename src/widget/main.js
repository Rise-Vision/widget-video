/* global gadgets, RiseVision, config, version */

( function( window, gadgets ) {
  "use strict";

  var id = new gadgets.Prefs().getString( "id" ),
    isWaitingForScriptDependencies = false,
    playOnceDependenciesAreLoaded = false,
    useRLS = false;

  // Disable context menu (right click menu)
  window.oncontextmenu = function() {
    return false;
  };

  function _playlistDependencyLoaded() {
    if ( isWaitingForScriptDependencies ) {
      isWaitingForScriptDependencies = false;

      if ( playOnceDependenciesAreLoaded ) {
        playOnceDependenciesAreLoaded = false;

        RiseVision.VideoRLS.play();
      }
    }
  }

  function canUseRLSSingleFile() {
    try {
      if ( top.useRLSSingleFile ) {
        return true;
      }
    } catch ( err ) {
      console.log( "widget-image", err ); // eslint-disable-line no-console
    }

    return false;
  }

  function canUseRLSFolder() {
    try {
      if ( top.useRLSFolder ) {
        return true;
      }
    } catch ( err ) {
      console.log( "widget-image", err ); // eslint-disable-line no-console
    }

    return false;
  }


  function _loadPlaylistPluginScript() {
    var src = config.VENDOR_PATH + "videojs/dist/videojs-playlist.min.js",
      script = document.createElement( "script" );

    isWaitingForScriptDependencies = true;

    script.async = false;
    script.addEventListener( "load", _playlistDependencyLoaded );
    script.src = src;

    document.body.appendChild( script );
  }

  function configure( names, values ) {
    var additionalParams = null,
      mode = "",
      companyId = "",
      displayId = "";

    if ( Array.isArray( names ) && names.length > 0 && Array.isArray( values ) && values.length > 0 ) {
      if ( names[ 0 ] === "companyId" ) {
        companyId = values[ 0 ];
      }

      if ( names[ 1 ] === "displayId" ) {
        if ( values[ 1 ] ) {
          displayId = values[ 1 ];
        } else {
          displayId = "preview";
        }
      }

      RiseVision.Common.LoggerUtils.setIds( companyId, displayId );
      RiseVision.Common.LoggerUtils.setVersion( version );

      if ( names[ 2 ] === "additionalParams" ) {
        additionalParams = JSON.parse( values[ 2 ] );

        if ( Object.keys( additionalParams.storage ).length !== 0 ) {
          // storage file or folder selected
          if ( !additionalParams.storage.fileName ) {
            // folder was selected
            mode = "folder";
            _loadPlaylistPluginScript();

            // TODO: trigger test coverage for RLS with folder
            useRLS = config.TEST_USE_RLS || canUseRLSFolder();
          } else {
            // file was selected
            mode = "file";

            // integration tests will set TEST_USE_RLS to true
            useRLS = config.TEST_USE_RLS || canUseRLSSingleFile();
          }
        } else {
          // non-storage file was selected
          mode = "file";
        }

        if ( useRLS ) {
          // proceed with using RLS for single file
          RiseVision.VideoRLS.setAdditionalParams( additionalParams, mode, displayId, companyId );
          return;
        }

        // check which version of Rise Cache is running and dynamically add rise-storage dependencies
        RiseVision.Common.RiseCache.isRCV2Player( function( isV2 ) {
          var fragment = document.createDocumentFragment(),
            link = document.createElement( "link" ),
            webcomponents = document.createElement( "script" ),
            href = config.COMPONENTS_PATH + ( ( isV2 ) ? "rise-storage-v2" : "rise-storage" ) + "/rise-storage.html",
            storage = document.createElement( "rise-storage" );

          function init() {
            RiseVision.Video.setAdditionalParams( additionalParams, mode, displayId );
          }

          function onStorageReady() {
            storage.removeEventListener( "rise-storage-ready", onStorageReady );
            init();
          }

          webcomponents.src = config.COMPONENTS_PATH + "webcomponentsjs/webcomponents-loader.js";

          // add the webcomponents polyfill source to the document head
          document.getElementsByTagName( "head" )[ 0 ].appendChild( webcomponents );

          link.setAttribute( "rel", "import" );
          link.setAttribute( "href", href );

          // add the rise-storage <link> element to document head
          document.getElementsByTagName( "head" )[ 0 ].appendChild( link );

          storage.setAttribute( "id", "videoStorage" );
          storage.setAttribute( "refresh", 5 );

          if ( isV2 ) {
            storage.setAttribute( "usage", "widget" );
          }

          storage.addEventListener( "rise-storage-ready", onStorageReady );
          fragment.appendChild( storage );

          // add the <rise-storage> element to the body
          document.body.appendChild( fragment );
        } );
      }
    }
  }

  function play() {
    if ( !useRLS ) {
      RiseVision.Video.play();
    } else {
      if ( config.STORAGE_ENV === "test" || !isWaitingForScriptDependencies ) {
        RiseVision.VideoRLS.play();
      } else {
        playOnceDependenciesAreLoaded = true;
      }
    }

  }

  function pause() {
    if ( !useRLS ) {
      RiseVision.Video.pause();
    } else {
      playOnceDependenciesAreLoaded = false;

      RiseVision.VideoRLS.pause();
    }

  }

  function stop() {
    if ( !useRLS ) {
      RiseVision.Video.stop();
    } else {
      playOnceDependenciesAreLoaded = false;

      RiseVision.VideoRLS.stop();
    }
  }


  if ( id && id !== "" ) {
    gadgets.rpc.register( "rscmd_play_" + id, play );
    gadgets.rpc.register( "rscmd_pause_" + id, pause );
    gadgets.rpc.register( "rscmd_stop_" + id, stop );
    gadgets.rpc.register( "rsparam_set_" + id, configure );
    gadgets.rpc.call( "", "rsparam_get", null, id, [ "companyId", "displayId", "additionalParams" ] );
  }

} )( window, gadgets );
