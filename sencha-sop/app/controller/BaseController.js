/*jslint browser:true, vars: true */
/*globals Ext, SOP*/
"use strict";

/**
 */
Ext.define('SOP.controller.BaseController', {
    extend: 'Ext.app.Controller',

    startLoading: function () {
        Ext.select("body").addCls("sop_loading");
    },

    stopLoading: function () {
        Ext.select("body").removeCls("sop_loading");
    },
});