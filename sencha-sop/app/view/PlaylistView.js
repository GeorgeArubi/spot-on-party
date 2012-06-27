/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.PlaylistView", {
    extend: "Ext.dataview.DataView",
    xtype: "playlistview",
    requires: ["SOP.view.PlaylistEntryView", ],

    config: {
        title: "Playlist",
        flex: 1,
        useComponents: true,
        defaultType: "playlistentry",

        listeners: {
            rightbuttontap: function () {console.log("rightbuttontap"); },
            itemswipe: "onItemSwipe",
        },
        rightButtonInfo: {iconCls: "add", iconMask: true, ui: "action"},
    },

    onItemSwipe: function (container, target, index, event) {
        target.showDeleteConfirm();
    },
});