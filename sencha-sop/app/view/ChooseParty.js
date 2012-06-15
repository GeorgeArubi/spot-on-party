/*jslint sloppy: true*/
/*globals Ext*/

Ext.define("SOP.view.ChooseParty", {
    extend: "Ext.navigation.View",

    config: {
        id: "mainNav",
        items: [{
            title: "Choose Party",
            layout: "vbox",
        }]
    },

    initialize: function () {
        this.callParent(arguments);
        console.log("jo", this.store);
        this.items.first().add([{
            xtype: 'list',
            flex: 1,
            itemTpl: '{name}',
            store: this.store,
        }]);
    },
});

