/*jslint */
/*globals Ext, SOP */
"use strict";

/**
 * parent class for all model classes that connect to the SOP backend
 */
Ext.define("SOP.domain.SopBase", {
    requires: ["Ext.data.JsonP"],

    statics: {
        doCall: function (path, extra_parameters, callback) {
            var params = Ext.merge({at: SOP.authResponse.accessToken}, extra_parameters),
                url = SOP.app.SopBackend + path;
            console.log(url);
            Ext.data.JsonP.request({
                url: url,
                params: params,
                callbackKey: "callback",
                success: function (result, request) {
                    if (callback) {
                        callback(result);
                    }
                }
            });
        },

        createParty: function (name, invited_friends, callback) {
            this.doCall("createparty", {name: name, invited_user_ids: invited_friends.join(",")}, callback);
        },

        removeSong: function (party_id, position, callback) {
            this.doCall("removesong", {party_id: party_id, position: position}, callback);
        },

        playPosition: function (party_id, position, callback) {
            this.doCall("playposition", {party_id: party_id, position: position}, callback);
        },

        getActiveParties: function (callback) {
            this.doCall("getactiveparties", {}, callback);
        },
        getActions: function (party_id, callback) {
            this.doCall("getactions", {party_id: party_id}, callback);
        },
    }
});