/*jslint vars: true */
/*globals Ext, SOP, goog */
"use strict";

/**
 * parent class for all model classes that connect to the SOP backend
 */
Ext.define("SOP.domain.SopBaseDomain", {
    requires: ["Ext.data.JsonP", "SOP.domain.FacebookDomain", "Ext.JSON"],
    mixins: ['Ext.mixin.Observable'],

    singleton: true,

    BASE_URL: "//tiggr.local:8081/api/1/",

    channel_info: null,

    doCall: function (path, extra_parameters, callback) {
        var that = this;
        SOP.domain.FacebookDomain.getAccessToken(function (accesstoken) {
            if (that.channel_info === null) {
//                goog.appengine.Socket.POLLING_TIMEOUT_MS = 3000; //decreasing polling interval results in lost data
                that.channel_info = "loading";
                that.doCall_helper("getchanneltoken", {}, accesstoken, function (channel_info) {
                    that.channel_info = channel_info;
                    that.channel_info.channel = new goog.appengine.Channel(that.channel_info.token);
                    var callback_functions;
                    callback_functions = {
                        onopen: function () {
                            console.log("channel open");
                        },
                        onmessage: function (message) {
                            that.onMessage(Ext.JSON.decode(message.data));
                        },
                        onerror: function (error) {
                            console.log("channel error", error);
                        },
                        onclose: function () {
                            console.log("channel close");
                            //TODO: after 2 hours we need a new token
                            that.channel_info.channel.open(callback_functions);
                        }
                    };
                    that.channel_info.channel.open(callback_functions);
                });
            }
            that.doCall_helper(path, extra_parameters, accesstoken, callback);
        });
    },

    doCall_helper: function (path, extra_parameters, accesstoken, callback) {
        var that = this;
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
    },

    onMessage: function (message_data) {
        console.log("onmessage", message_data);
        var that = this;
        var message_type = message_data.type;
        switch (message_type) {
        case "addparty":
            that.fireEvent(message_type, message_data.party);
            break;
        }
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

    getParty: function (party_id, callback) {
        this.doCall("getparty", {party_id: party_id}, callback);
    },

    followParty: function (callback) {
//        this.doCall("followparty", {}, callback)
    },

    getActions: function (party_id, last_action_id, callback) {
        this.doCall("getactions", {party_id: party_id, last_action_id: last_action_id}, callback);
    },
});