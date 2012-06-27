/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.PlaylistView", {
    extend: "Ext.dataview.DataView",
    requires: ["SOP.view.PlaylistEntryView"],

    config: {
        title: "Playlist",
        flex: 1,
        useComponents: true,
        defaultType: "playlistentry"
    },
});