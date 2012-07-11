/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.default.PartyTabs", {
    xtype: "partytabs",
    extend: "Ext.TabPanel",
    requires: ["Ext.MessageBox"],

    config: {
        tabBarPosition: 'bottom',
        party: null,
        title: null,
        listeners: {
            initialize: "onInitialize",
            show: "onShow",
            hide: "onHide",
            activeitemchange: "rightButtonSetter",
        },
        myNavigationView: null,
        myInactiveMessageBox: null,
    },

    nameChanged: function () {
        this.setTitle(this.getParty().get('name'));
    },

    activeChanged: function () {
        var that = this;
        if (that.getParty().get('active')) {
            if (that.getMyInactiveMessageBox()) {
                var mesbox = that.getMyInactiveMessageBox();
                mesbox.hide();
                Ext.defer(function () {
                    mesbox.destroy();
                }, 2000);
                that.setMyInactiveMessageBox(null);
            }
        } else {
            if (!that.getMyInactiveMessageBox()) {
                that.setMyInactiveMessageBox(Ext.create("Ext.MessageBox").show({
                    title       : "Party Ended",
                    message     : "The plug has been pulled on this party. Perhaps the neighbours were unhappy, or some people decided that work in the morning is of equal importance to the party. It's up to you, wait until the party starts again, or choose another party",
                    buttons     : [{text: "leave"}],
                    fn          : function () { that.up("chooseparty").fireEvent("back"); },
                }));
            }
        }
    },

    onShow: function () {
        var that = this;
        that.getParty().on("namechanged", this.nameChanged, this);
        that.getParty().on("activechanged", this.activeChanged, this);
        that.nameChanged();
        that.activeChanged();
    },

    onHide: function () {
        var that = this;
        that.getParty().un("namechanged", this.updateName);
    },

    onInitialize: function () {
        this.add(Ext.create("SOP.view.PlaylistView", {
            store: this.getParty().getPlaylistEntryStore(),
        }));
        this.add(Ext.create("Ext.Button", {
            text: "hello",
            "title": "hi",
        }));
    },

    rightButtonSetter: function (container, value, oldValue) {
        var that = this;
        if (value !== oldValue) {
            if (value && value.getRightButtonInfo && value.getRightButtonInfo()) {
                that.getMyNavigationView().setRightButton(value.getRightButtonInfo());
                that.getMyNavigationView().getRightButton().on("tap", function () {value.fireEvent("rightbuttontap"); });
            } else {
                that.getMyNavigationView().setRightButton(null);
            }
        }
    },
});
