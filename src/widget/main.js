/* global gadgets, RiseVision, config, version */

( function( window, gadgets ) {
  "use strict";

  var id = new gadgets.Prefs().getString( "id" ),
    utils = RiseVision.Common.Utilities,
    isWaitingForScriptDependencies = false,
    playOnceDependenciesAreLoaded = false,
    useWatch = false;

  // Disable context menu (right click menu)
  window.oncontextmenu = function() {
    return false;
  };

  function _playlistDependencyLoaded() {
    if ( isWaitingForScriptDependencies ) {
      isWaitingForScriptDependencies = false;

      if ( playOnceDependenciesAreLoaded ) {
        playOnceDependenciesAreLoaded = false;

        RiseVision.VideoWatch.play();
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
    var src = config.COMPONENTS_PATH + "videojs-playlist/dist/videojs-playlist.min.js",
      script = document.createElement( "script" );

    isWaitingForScriptDependencies = true;

    script.async = false;
    script.addEventListener( "load", _playlistDependencyLoaded );
    script.src = src;

    document.body.appendChild( script );
  }

  function _isFolder( additionalParams ) {
    return !additionalParams.storage.fileName;
  }

  function _canUseRLS( mode ) {
    // integration tests will set TEST_USE_RLS to true
    if ( mode === "folder" ) {
      return config.TEST_USE_RLS || canUseRLSFolder();
    }

    return config.TEST_USE_RLS || canUseRLSSingleFile();
  }

  function _configureStorageUsage( additionalParams, displayId, companyId ) {
    var mode = _isFolder( additionalParams ) ? "folder" : "file";

    if ( mode === "folder" ) {
      _loadPlaylistPluginScript();
    }

    if ( utils.useContentSentinel() ) {
      return utils.isServiceWorkerRegistered()
        .then( function() {
          useWatch = true;
          RiseVision.VideoWatch.setAdditionalParams( additionalParams, mode, displayId, companyId, "sentinel" );
        } )
        .catch( function( err ) {
          console.log( err ); // eslint-disable-line no-console

          /* TODO: Do we send "ready" event to Viewer and on receiving "play" immediately send "done"? Or do we not send "ready" and do nothing?
           */
        } );
    }

    if ( _canUseRLS( mode ) ) {
      useWatch = true;
      return RiseVision.VideoWatch.setAdditionalParams( additionalParams, mode, displayId, companyId, "rls" );
    }

    _processStorageNonWatch( additionalParams, mode, displayId )
  }

  function _processStorageNonWatch( additionalParams, mode, displayId ) {
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

      webcomponents.src = config.COMPONENTS_PATH + "webcomponentsjs/webcomponents.js";

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

  function configure( names, values ) {
    var additionalParams = null,
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
      RiseVision.Common.LoggerUtils.startEndpointHeartbeats( "widget-video" );

      if ( names[ 2 ] === "additionalParams" ) {
        additionalParams = JSON.parse( values[ 2 ] );

        if ( Object.keys( additionalParams.storage ).length !== 0 ) {
          _configureStorageUsage( additionalParams, displayId, companyId );
        } else {
          // non-storage file was selected
          RiseVision.Video.setAdditionalParams( additionalParams, "file", displayId );
        }
      }
    }
  }

  function play() {
    if ( !useWatch ) {
      RiseVision.Video.play();
    } else {
      if ( config.STORAGE_ENV === "test" || !isWaitingForScriptDependencies ) {
        RiseVision.VideoWatch.play();
      } else {
        playOnceDependenciesAreLoaded = true;
      }
    }

  }

  function pause() {
    if ( !useWatch ) {
      RiseVision.Video.pause();
    } else {
      playOnceDependenciesAreLoaded = false;

      RiseVision.VideoWatch.pause();
    }

  }

  function stop() {
    if ( !useWatch ) {
      RiseVision.Video.stop();
    } else {
      playOnceDependenciesAreLoaded = false;

      RiseVision.VideoWatch.stop();
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
