( function data( window ) {
  "use strict";

  window.gadget = window.gadget || {};
  window.gadget.settings = {
    "params": {},
    "additionalParams": {
      "url": "",
      "selector": {
        "selection": "single-folder",
        "storageName": "Widgets/videos/",
        "url": "https://www.googleapis.com/storage/v1/b/risemedialibrary-b428b4e8-c8b9-41d5-8a10-b4193c789443/o?prefix=Widgets%2Fvideos%2F"
      },
      "storage": {
        "folder": "Widgets/videos/",
        "fileName": "",
        "companyId": "b428b4e8-c8b9-41d5-8a10-b4193c789443"
      },
      "video": {
        "scaleToFit": true,
        "volume": 50,
        "controls": true,
        "autoplay": true,
        "resume": true,
        "pause": 5
      }

    }
  };
} )( window );
