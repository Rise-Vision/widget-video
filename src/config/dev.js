/* exported config */
if (typeof angular !== "undefined") {
  angular.module("risevision.common.i18n.config", [])
    .constant("LOCALES_PREFIX", "components/rv-common-i18n/dist/locales/translation_")
    .constant("LOCALES_SUFIX", ".json");

  angular.module("risevision.widget.common.storage-selector.config")
    .value("STORAGE_MODAL", "https://apps-stage-0.risevision.com/storage-selector.html#/?cid=");
}

var config = {
    /*
     NOTE: Relative path to skin file does not work when viewing/testing locally using Preview app

     When needing to work on custom skin file "RVSkin.xml", change SKIN value to point to full server location
     CORS will be required. Handy CORS Chrome extension can be found here
     https://chrome.google.com/webstore/detail/allow-control-allow-origi/nlfbmbojpeacfghkpbjhddihlkkiljbi?hl=en
     */
    SKIN: "",
    STORAGE_ENV: "test"
};
