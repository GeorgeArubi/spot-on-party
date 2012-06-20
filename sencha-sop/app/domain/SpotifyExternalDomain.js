/*jslint browser:true, vars: true, plusplus: true,  */
/*globals Ext, FB, SOP*/
"use strict";

/**
 */
Ext.define('SOP.domain.SpotifyExternalDomain', {
    singleton: true,

    CALL_DELAY: 1500, //nr of ms between calls to spotify API -- rate limited on 10/sec, so we do 7/sec just to be sure
    LOOKUP_URL: "http://ws.spotify.com/lookup/1/.json",

    lastcallTime: 0,
    callQueue: [],
    queueTimer: null,
    counter: 0,

    lookup: function (uri, callback) {
        var that = this;
        var params = {uri: uri};
        that.counter++;
        that.callQueue.push({url: that.LOOKUP_URL, params: params, callback: callback, counter: that.counter});
        that.handleQueue();
        return that.counter;
    },

    handleQueue: function () {
        var that = this;
        if (this.callQueue.length === 0) {
            return;
        }
        var now = (new Date()).valueOf();
        var wait = that.lastcallTime + this.CALL_DELAY - now;
        if (wait > 0) {
            window.clearTimeout(this.queueTimer);
            this.queueTimes = Ext.defer(Ext.bind(that.handleQueue, that), wait);
            return;
        }
        that.lastcallTime = now;
        var call = that.callQueue.splice(0, 1)[0]; // this pops one item off the callqueue top
        console.log("Spotify call: " + call.url, call.params);
        Ext.Ajax.request({url: call.url,
                          params: call.params,
                          useDefaultXhrHeader: false,
                          method: "GET",
                          disableCaching: false,
                          success: function (response) {call.callback(Ext.JSON.decode(response.responseText)); },
                         });
    },
});