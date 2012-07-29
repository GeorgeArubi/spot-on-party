/*jslint browser: true, vars: true */
/*globals Ext, SOP, goog */
"use strict";

/**
 * parent class for all model classes that connect to the SOP backend
 */
Ext.define("SOP.domain.SopBaseDomain", {
    requires: ["Ext.data.JsonP", "Ext.JSON"],
    mixins: ['Ext.mixin.Observable'],

    singleton: true,

//    BASE_URL:  (window.location.protocol === "https" ? "https:" : "http:") + "//tiggr.local:8081/api/1/",
    BASE_URL:  (window.location.protocol === "https" ? "https:" : "http:") + "//sopbase.appspot.com/api/1/",

    sid: String(Math.random()).substr(2),
    channel_info: null,

    doCall: function (path, extra_parameters, callback) {
        var that = this;
        SOP.domain.FacebookDomain.getAccessToken(function (accesstoken) {
            if (that.channel_info === null) {
                that.channel_info = "loading";
                var google_channel_api_url = that.BASE_URL + "../../_ah/channel/jsapi";
                var newScript = window.document.createElement('script');
                newScript.type = 'text/javascript';
                newScript.src = google_channel_api_url;
                window.document.getElementsByTagName("head")[0].appendChild(newScript);

                var to_execute;
                to_execute = function () {
                    if (window.goog && window.goog.appengine && window.goog.appengine.Channel) {
                        Ext.defer(function () {
//                            goog.appengine.Socket.POLLING_TIMEOUT_MS = 300000; //decreasing polling interval results in lost data
                        }, 60000);
                        goog.appengine.Socket.BASE_URL = that.BASE_URL + "../.." + goog.appengine.Socket.BASE_URL;
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
                    } else {
                        window.setTimeout(to_execute, 20); // probably some browsers will have a callback, but this will do for now
                    }
                };
                to_execute();
            }
            that.doCall_helper(path, extra_parameters, accesstoken, callback);
        });
    },

    doCall_helper: function (path, extra_parameters, accesstoken, callback) {
        var that = this;
        var params = Ext.merge({at: accesstoken, sid: that.sid}, extra_parameters);
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
        console.log("onmessage", message_data, message_data.action, (message_data.action ? message_data.action.type : ""));
        var that = this;
        var message_type = message_data.type;
        switch (message_type) {
        case "addparty":
            that.fireEvent(message_type, message_data.party);
            break;
        case "removeparty":
            that.fireEvent(message_type, message_data.party);
            break;
        case "partyaction":
            that.fireEvent(message_type + "_" + message_data.party_id, message_data.action);
            break;
        default:
            throw "Unknown type: " + message_type;
        }
    },

    createParty: function (name, callback) {
        this.doCall("createparty", {name: name}, callback);
    },

    activate: function (party_id, callback) {
        this.doCall("partyon", {party_id: party_id}, callback);
    },

    deactivate: function (party_id, callback) {
        this.doCall("partyoff", {party_id: party_id}, callback);
    },

    inviteUsers: function (party_id, user_ids, callback) {
        this.doCall("inviteusers", {party_id: party_id, invited_user_ids: user_ids.join(",")}, callback);
    },

    kickUsers: function (party_id, user_ids, callback) {
        this.doCall("kickusers", {party_id: party_id, kicked_user_ids: user_ids.join(",")}, callback);
    },

    addSong: function (party_id, song_id, callback) {
        this.doCall("addsong", {party_id: party_id, song_id: song_id}, callback);
    },

    removeSong: function (party_id, position, callback) {
        this.doCall("removesong", {party_id: party_id, position: position}, callback);
    },

    playPosition: function (party_id, position, callback) {
        this.doCall("playposition", {party_id: party_id, position: position}, callback);
    },

    updatePlayStatus: function (party_id, playing, position, miliseconds, callback) {
        this.doCall("updateplaystatus", {
            party_id: party_id,
            playing: (playing ? "true" : "false"),
            position: position,
            miliseconds: miliseconds,
        }, callback);
    },

    getActiveParties: function (callback) {
        this.doCall("getactiveparties", {}, callback);
    },

    getInactiveParties: function (callback) {
        this.doCall("getinactiveparties", {}, callback);
    },

    getOwnedParties: function (callback) {
        this.doCall("getownedparties", {}, callback);
    },

    getParty: function (party_id, callback) {
        this.doCall("getparty", {party_id: party_id}, callback);
    },

    joinParty: function (party_id, callback, scope) {
        var that = this;
        that.doCall("joinparty", {party_id: party_id}, function () {});
        that.on("partyaction_" + party_id, callback, scope);
    },

    leaveParty: function (party_id, callback, scope) {
        var that = this;
        that.doCall("leaveparty", {party_id: party_id}, function () {});
        that.un("partyaction_" + party_id, callback, scope);
    },

    getActions: function (party_id, last_action_id, callback) {
        this.doCall("getactions", {party_id: party_id, last_action_id: last_action_id}, callback);
    },
});