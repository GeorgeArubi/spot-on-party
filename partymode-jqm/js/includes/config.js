/*jshint */
/*global exports*/

var root = this;
var config;

if (typeof exports !== "undefined") {
    /* node */
    config = exports;
} else {
    root.PM = root.PM || {};
    root.PM.config = root.PM.config || {};
    config = root.PM.config;
}

(function (config) {
    "use strict";
    config.is_master = true;
    config.master_name = "Party Owner";
}(config));
