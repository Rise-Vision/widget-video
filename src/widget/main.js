/* global gadgets, RiseVision, config */

(function (window, gadgets) {
  "use strict";

  var prefs = new gadgets.Prefs(),
    id = prefs.getString("id"),
    defaultDisplayId = "preview",
    storageReady = false,
    polymerReady = false,
    additionalParams = null,
    mode;

  // Disable context menu (right click menu)
  window.oncontextmenu = function () {
    return false;
  };

  function configure(names, values) {
    var companyId = "",
      displayId = "";

    if (Array.isArray(names) && names.length > 0 && Array.isArray(values) && values.length > 0) {
      if (names[0] === "companyId") {
        companyId = values[0];
      }

      if (names[1] === "displayId") {
        if (values[1]) {
          displayId = values[1];
        }
        else {
          displayId = defaultDisplayId;
        }
      }

      RiseVision.Common.RiseCache.isV2Running(function(isV2) {
        addRiseStorage(isV2, displayId);
      });

      RiseVision.Common.LoggerUtils.setIds(companyId, displayId);
      RiseVision.Common.LoggerUtils.setVersion(version);

      if (names[2] === "additionalParams") {
        additionalParams = JSON.parse(values[2]);

        if (Object.keys(additionalParams.storage).length !== 0) {
          // storage file or folder selected
          if (!additionalParams.storage.fileName) {
            // folder was selected
            mode = "folder";
          } else {
            // file was selected
            mode = "file";
          }
        } else {
          // non-storage file was selected
          mode = "file";
        }
      }
    }
  }

  function play() {
    RiseVision.Video.play();
  }

  function pause() {
    RiseVision.Video.pause();
  }

  function stop() {
    RiseVision.Video.stop();
  }

  function init() {
    addPolyfill();

    if (id && id !== "") {
      gadgets.rpc.register("rscmd_play_" + id, play);
      gadgets.rpc.register("rscmd_pause_" + id, pause);
      gadgets.rpc.register("rscmd_stop_" + id, stop);

      gadgets.rpc.register("rsparam_set_" + id, configure);
      gadgets.rpc.call("", "rsparam_get", null, id, ["companyId", "displayId", "additionalParams"]);
    }
  }

  function onPolymerReady() {
    window.removeEventListener("WebComponentsReady", onPolymerReady);
    polymerReady = true;

    if (storageReady && polymerReady) {
      RiseVision.Video.setAdditionalParams(additionalParams, mode);
    }
  }

  function onStorageReady() {
    var storage = document.createElement("rise-storage");

    storage.removeEventListener("rise-storage-ready", onStorageReady);
    storageReady = true;

    if (storageReady && polymerReady) {
      RiseVision.Video.setAdditionalParams(additionalParams, mode);
    }
  }

  function addPolyfill() {
    var webcomponents = document.createElement("script");

    webcomponents.src = config.COMPONENTS_PATH + "webcomponentsjs/webcomponents-lite.min.js";

    window.addEventListener("WebComponentsReady", onPolymerReady);
    document.getElementsByTagName("head")[0].appendChild(webcomponents);
  }

  function addRiseStorage(isV2, displayId) {
    var fragment = document.createDocumentFragment(),
      link = document.createElement("link"),
      storage = document.createElement("rise-storage"),
      refresh = (displayId === defaultDisplayId) ? 0 : 5,
      storagePath = "rise-storage",
      href;

    if (isV2 || (displayId === defaultDisplayId)) {
      storagePath += "-v2";
    }

    href = config.COMPONENTS_PATH + storagePath + "/rise-storage.html";

    link.setAttribute("rel", "import");
    link.setAttribute("href", href);

    // add the rise-storage <link> element to document head
    document.getElementsByTagName("head")[0].appendChild(link);

    storage.setAttribute("id", "videoStorage");
    storage.setAttribute("refresh", refresh);
    storage.addEventListener("rise-storage-ready", onStorageReady);
    fragment.appendChild(storage);

    // add the <rise-storage> element to the body
    document.body.appendChild(fragment);
  }

  init();

})(window, gadgets);


