/*jslint */
/*globals Ext*/
"use strict";

Ext.define("SOP.model.Playlist", {
    extend: "Ext.data.Model",

    config: {
        fields: ["party_id"],
        belongsTo: "Sop.model.Party",
        hasMany: "Sop.model.Track",
    },
});
