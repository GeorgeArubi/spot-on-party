/*jslint sloppy: true*/
/*globals Ext, SOP*/

Ext.define("SOP.view.PartyTabs", {
    extend: "Ext.TabPanel",

    config: {
        defaults: {
            styleHtmlContent: true
        },
        tabBarPosition: 'bottom',
        title: "hey man",
        items: [
            { xtype: "button", text: "clickme1", title: "cool1", listeners: {show: function () {console.log("show"); }, hide: function () {console.log("hide"); }} },
            { xtype: "button", text: "clickme2", title: "cool2" },
            { xtype: "button", text: "clickme3", title: "cool3" },
            { xtype: "button", text: "clickme4", title: "cool4" },
        ],
    }
});
