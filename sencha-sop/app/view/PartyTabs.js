/*jslint sloppy: true*/
/*globals Ext, SOP*/

Ext.define("SOP.view.PartyTabs", {
    extend: "Ext.TabPanel",

    config: {
        tabBarPosition: 'bottom',
        party: null,
        title: null,
    },

    updateName: function () {
        this.setTitle(this.getParty().get('name'));
    },

    onShow: function () {
        this.getParty().on("namechanged", this.updateName, this);
        this.updateName();
    },

    onHide: function () {
        this.getParty().un("namechanged", this.updateName);
    },


    initialize: function () {
        this.callParent(arguments);
        this.add(Ext.create("SOP.view.PlaylistView", {
            store: this.getParty().getPlaylistEntryStore(),
        }));
        this.on("show", this.onShow, this);
        this.on("hide", this.onHide, this);
    },
});
