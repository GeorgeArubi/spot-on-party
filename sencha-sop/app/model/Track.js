/*jslint */
/*globals Ext*/
"use strict";

Ext.define("SOP.model.Track", {
    extend: "Ext.data.Model",

    config: {
        fields: ["id", "name", "artist"],
    }
});
