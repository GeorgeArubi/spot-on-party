/*jslint */
/*globals Ext*/
"use strict";

Ext.define("SOP.view.ChooseParty", {
    extend: "Ext.NavigationView",

    config: {
        fullscreen: true,
        id: "mainNav",
        items: [{
            title: "Choose Party",
            items: [{
                xtype: 'button',
                text: 'Push a new view!',
                handler: function () {
                    Ext.getCmp("mainNav").push({"title": "hello"});
                }
            }],
            
        }]
    },
});

