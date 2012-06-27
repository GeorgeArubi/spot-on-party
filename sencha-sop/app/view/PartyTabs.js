/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.PartyTabs", {
    extend: "Ext.TabPanel",

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
    },

    updateName: function () {
        this.setTitle(this.getParty().get('name'));
    },

    onShow: function () {
        var that = this;
        that.getParty().on("namechanged", this.updateName, this);
        that.updateName();
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
