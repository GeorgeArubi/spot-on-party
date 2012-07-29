/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.PlaylistEntryView", {
    extend: "Ext.dataview.component.DataItem",
    xtype: "playlistentry",
    requires: ["Ext.String", "Ext.Label"],

    config: {
        items: [
            {xtype: "panel", cls: "delete-confirm-overlay", localid: "delete-confirm-overlay"},
            {xtype: "container", cls: "delete-confirm-btn-mask", items: [
                {xtype: "button", ui: "decline", cls: "delete-confirm-btn", text: "delete", localid: "delete-confirm-btn"},
            ]},
            {xtype: "label", cls: "playlist-name", localid: "name"},
            {xtype: "label", cls: "playlist-artist", localid: "artist"},
            {xtype: "label", cls: "playlist-user-added", localid: "user-added"},
            {xtype: "label", cls: "playlist-user-deleted", localid: "user-deleted"},
            {xtype: "container", cls: "buttons", items: [
                {xtype: "button", cls: "playlist-play-btn", ui: "round", iconCls: "arrow_right", iconMask: true, flex: 2, localid: "play-btn"},
                {xtype: "spacer", flex: 1},
                {xtype: "button", cls: "playlist-delete-btn", iconCls: "trash", iconMask: true, flex: 2, localid: "delete-btn"},
            ], layout: "hbox"},
        ],

        cls: ["playlist-entry", "new", ],

        listeners: {
            updatedata: "onUpdateData",
            initialize: "onInitialize",
        },
        playlistEntry: null,
    },

    onInitialize: function () {
        var that = this;
        var play_btn = that.down("[localid=play-btn]");
        var delete_btn = that.down("[localid=delete-btn]");
        var delete_confirm_overlay = that.down("[localid=delete-confirm-overlay]");
        var delete_confirm_btn = that.down("[localid=delete-confirm-btn]");

        play_btn.on("tap", function () {that.getPlaylistView().fireEvent("play", that.playlistEntry); });
        delete_btn.on("tap", that.showDeleteConfirm, that);
        delete_confirm_overlay.element.on("tap", function () {that.getPlaylistView().fireEvent("deleteconfirmcancelled"); });
        delete_confirm_btn.on("tap", function () {
            that.hideDeleteConfirm();
            that.getPlaylistView().fireEvent("itemdelete", that.playlistEntry);
        });

    },

    getPlaylistView: function () {
        var that = this;
        return that.up("playlistview");
    },

    hasCls: function (cls) {
        var that = this;
        var mycls = that.getCls();
        if (Ext.isArray(mycls)) {
            return mycls.indexOf(cls) !== -1;
        }
        return cls === mycls;
    },

    showDeleteConfirm: function () {
        var that = this;
        if (that.hasCls("deleted")) {
            return;
        }
        that.addCls("delete-confirm");
        that.getPlaylistView().addCls("delete-confirm-mask");
        that.getPlaylistView().on("deleteconfirmcancelled", that.hideDeleteConfirm, that);
    },

    hideDeleteConfirm: function () {
        var that = this;
        that.removeCls("delete-confirm");
        that.getPlaylistView().removeCls("delete-confirm-mask");
        that.getPlaylistView().un("deleteconfirmcancelled", that.hideDeleteConfirm, that);
    },

    onUpdateData: function (container, playlistEntry) {
        var that = this;
        that.playlistEntry = playlistEntry;

        var trackNameLabel = that.down("[localid=name]");
        var trackArtistLabel = that.down("[localid=artist]");
        var userNameLabel = that.down("[localid=user-added]");
        var userDeletedLabel = that.down("[localid=user-deleted]");

        Ext.each([
            {label: trackNameLabel, object: "track", field: "name"},
            {label: trackArtistLabel, object: "track", field: "artist"},
            {label: userNameLabel, object: "user", field: "name"},
            {label: userDeletedLabel, object: "deleted_by_user", field: "name"},
        ], function (labelInfo) {
            if (playlistEntry[labelInfo.object]) {
                labelInfo.label.setHtml(Ext.String.htmlEncode(playlistEntry[labelInfo.object].get(labelInfo.field)));
                if (playlistEntry[labelInfo.object].get('loaded')) {
                    labelInfo.label.removeCls("lazy_loaded");
                    labelInfo.label.addCls("lazy_loading");
                } else {
                    labelInfo.label.removeCls("lazy_loading");
                    labelInfo.label.addCls("lazy_loaded");
                }
            } else {
                labelInfo.label.setHtml('');
                labelInfo.label.removeCls("lazy_loading");
                labelInfo.label.removeCls("lazy_loaded");
            }
        });
        if (playlistEntry.deleted_by_user) {
            that.addCls("deleted");
        } else {
            that.removeCls("deleted");
        }
        if (playlistEntry.is_playing) {
            that.addCls("playing");
            if (that.up("playlistview")) { // else just started; will (hopefully) set the scrolling later
                var contentHeight = that.element.dom.parentNode.clientHeight;
                var containerHeight = that.up("playlistview").element.dom.clientHeight;
                var scrollOffset = Math.max(Math.min(that.element.dom.offsetTop, contentHeight - containerHeight), 0);
                that.up("playlistview").getScrollable().getScroller().scrollTo(0, scrollOffset, true);
            }
        } else {
            that.removeCls("playing");
        }
        Ext.defer(function () {that.removeCls("new"); }, 1); //allows for new animation
    },
});
