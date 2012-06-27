/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.PlaylistEntryView", {
    extend: "Ext.dataview.component.DataItem",
    xtype: "playlistentry",
    require: ["Ext.String", "Ext.Label"],

    config: {
        trackName: null,
        trackArtist: null,
        userName: null,

        cls: "playlist-entry",

        dataMap: {
            getTrackName: {
                doUpdate: "track",
            },
            getTrackArtist: {
                doUpdate: "track",
            },
            getUserName: {
                doUpdate: "user",
            },
        },
    },

    initialize: function () {
        var that = this;
        var updateFunction = function (fieldname) {
            return function (object) {
                console.log("updatefunction");
                if (this.my_data !== object.get(fieldname)) {
                    this.my_data = object.get(fieldname);
                    this.setHtml(Ext.String.htmlEncode(this.my_data));
                    if (object.get('loaded')) {
                        this.removeCls("lazy_loaded");
                        this.addCls("lazy_loading");
                    } else {
                        this.removeCls("lazy_loading");
                        this.addCls("lazy_loaded");
                    }
                }
            };
        };

        var trackNameCmp = Ext.create("Ext.Label", {
            doUpdate: updateFunction("name"),
        });
        var trackArtistCmp = Ext.create("Ext.Label", {
            doUpdate: updateFunction("artist"),
        });
        var userNameCmp = Ext.create("Ext.Label", {
            doUpdate: updateFunction("name"),
        });

        that.setTrackName(trackNameCmp);
        that.setTrackArtist(trackArtistCmp);
        that.setUserName(userNameCmp);

        that.add([trackNameCmp, trackArtistCmp, userNameCmp]);
    },
});
