/*jslint vars: true */
/*globals Ext, SOP */
"use strict";

/**
 * parent class for all model classes that connect to the SOP backend
 */
Ext.define("SOP.domain.SopBaseDomain", {
    requires: ["Ext.data.JsonP", "SOP.domain.FacebookDomain"],

    singleton: true,

    BASE_URL: "//tiggr.local:8081/api/1/",

    doCall: function (path, extra_parameters, callback) {
        var that = this;
        SOP.domain.FacebookDomain.getAccessToken(function (accesstoken) {
            var params = Ext.merge({at: accesstoken}, extra_parameters);
            var url = that.BASE_URL + path;
            Ext.data.JsonP.request({
                url: url,
                params: params,
                callbackKey: "callback",
                success: function (result, request) {
                    console.log("sop calling:", url, result);
                    if (callback) {
                        callback(result);
                    }
                }
            });
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
    getActions: function (party_id, last_action_id, callback) {
        this.doCall("getactions", {party_id: party_id, last_action_id: last_action_id}, callback);
    },
});