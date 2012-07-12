/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.spotifyapp.PartyPane", {
    xtype: "partypane",
    extend: "Ext.Container",

    config: {
        party: null,
        title: null,
        layout: "hbox",
        items: [
            {
                xtype: "container",
                flex: 2,
                id: "playlist-pane",
                layout: "vbox",
            },
            {
                xtype: "container",
                layout: "vbox",
                flex: 1,
                items: [
                    {
                        xtype: "container",
                        flex: 1,
                        id: "users-pane",
                        layout: "vbox",
                    },
                    {
                        xtype: "container",
                        flex: 1,
                        id: "newsfeed-pane",
                        layout: "vbox",
                    },
                ],
            },
        ],

        listeners: {
            initialize: "onInitialize",
            show: "onShow",
            hide: "onHide",
        },
        myNavigationView: null,
    },

    nameChanged: function () {
        this.setTitle(this.getParty().get('name'));
    },

    onShow: function () {
        var that = this;
        that.getParty().on("namechanged", this.nameChanged, this);
        that.nameChanged();
    },

    onHide: function () {
        var that = this;
        that.getParty().un("namechanged", this.updateName);
    },

    onInitialize: function () {
        var that = this;
        var playlistview = Ext.create("SOP.view.PlaylistView", {
            store: this.getParty().getPlaylistEntryStore(),
        });
        that.down("#playlist-pane").add(Ext.merge({xtype: "button", localid: "rightbutton"}, playlistview.getRightButtonInfo()));
        that.down("#playlist-pane").add(playlistview);
        that.down("#playlist-pane").down("button[localid=rightbutton]").on("tap", function () {that.fireEvent("addsongbuttontap"); });

        var userlistview = Ext.create("SOP.view.UserlistView", {
            store: this.getParty().getUserInPartyStore(),
            party: this.getParty(),
        });
        that.down("#users-pane").add(Ext.merge({xtype: "button", localid: "rightbutton"}, userlistview.getRightButtonInfo()));
        that.down("#users-pane").add(userlistview);
        that.down("#users-pane").down("button[localid=rightbutton]").on("tap", function () {that.fireEvent("adduserbuttontap"); });

    },
});
