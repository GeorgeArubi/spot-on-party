/*jslint vars: true*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.view.AddSongsView", {
    extend: "Ext.Container",
    xtype: "addsongs",
    requires: ["Ext.field.Search", "Ext.TitleBar", "Ext"],

    config: {
        layout: "vbox",
        cls: "addsongs",
        items: [
            {xtype: "titlebar", docked: "top", title: "Add songs", items: [
                {xtype: "button", text: "cancel", align: "right", localid: "cancel-btn"},
            ]},
            {xtype: "searchfield", },
            {
                xtype: "container",
                localid: "searchresults",
                cls: "searchresults",
                flex: 1,
                layout: "vbox",
                items: [
                    {xtype: "component", cls: "loader"},
                    {
                        xtype: "dataview",
                        flex: 1,
                        store: {model: "SOP.model.Track", data: [], },
                        itemTpl: '<div class="title">{name}</div><div class="subtitle">{album} - {artist}</div>'
                    },
                ],
            },
        ],
        style: "z-index: 100;",
        listeners: {
            initialize: "onInitialize",
            hide: "onHide",
            aftershowanimation: "onAfterShowAnimation",
        },
    },

    onInitialize: function () {
        var that = this;
        that.down("[localid=cancel-btn]").on("tap", function () {that.fireEvent("cancel"); });
        that.down("searchfield").on("action", function (search) {that.fireEvent("search", search.getValue()); });
        that.down("searchfield").on("keyup", function (search) {that.fireEvent("invalidatesearchresults"); });
        that.down("[localid=searchresults]").down("dataview").on("itemtap", function (dataview, index, target, record, event) {
            that.fireEvent("addtrack", record.get('id'));
        });
        that.setShowAnimation({
            type: "slideIn",
            direction: "up",
            listeners: {animationend: function () {that.fireEvent("aftershowanimation"); }, },
        });
        that.setHideAnimation({
            type: "slideOut",
            direction: "down",
            listeners: {animationend: function () {that.fireEvent("afterhideanimation"); }, },
        });
    },

    onHide: function () {
        console.log("hide");
        var that = this;
        that.down("searchfield").blur();
    },

    onAfterShowAnimation: function () {
        var that = this;
        console.log("afye show");
        that.down("searchfield").focus();
    }
});