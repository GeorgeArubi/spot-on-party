/*jslint vars: true,*/
/*globals Ext, SOP*/
"use strict";

Ext.define("SOP.model.LazyBaseModel", {
    extend: "Ext.data.Model",
    requires: ["Ext.util.Format"],


    statics: {
        /**
          * creates a new object, which will only be loaded in time (or directly if the data is available.
          * fires the "loaded" event once loaded. Please note that the loaded event may be fired multiple times!
          */
        loadLazy: function (ids) {
            throw "Abstract, please extend";
        },
    },

    getLazyFieldHtml: function (fieldname, placeholder) {
        var that = this;
        if (that.get('loaded')) {
            return Ext.util.Format.htmlEncode(that.get(fieldname));
        }
        var dom_class = ("lazyload_" + fieldname + "_" + that.self.getName() + "_" + that.get('id')).toLowerCase().replace(/[:.]/g, "_");
        that.on("loaded", function () {
            Ext.select("." + dom_class).each(function (el) {el.dom.outerHTML = Ext.util.Format.htmlEncode(that.get(fieldname)); });
        });
        return ('<span class="' + dom_class + '">---</span>');
    },
});