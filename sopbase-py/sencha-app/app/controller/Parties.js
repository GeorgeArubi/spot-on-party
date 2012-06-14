/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.Parties', {
    extend: 'Ext.app.Controller',
    requires: 'SOP.model.Party',


    config: {
        control: {
        }
    },

    partyPicker: function () {
        SOP.model.Party.loadActivePartiesForLoggedinUser(function (parties) {
            this.partyStore = Ext.create("Ext.data.Store"
        });
    },
}