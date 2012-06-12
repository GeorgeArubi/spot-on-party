/*jslint plusplus: true, browser: true, vars: true, newcap: true*/

"use strict";

var STYLEMAGIC_WIDTH_MINUS = /^314151(\d+)(\w+)$/;
var STYLEMAGIC_HEIGHT_MINUS = /^314152(\d+)(\w+)$/;


var UtilPrototype = function () {
    var addDefaultLink;
    var variableWidthSettings;
    var init;

    init = function () {};

    /**
      * Takes a jquery list of links, and adds the javascript:void href
      **/
    addDefaultLink = function (links) {
        var url = "javascript";
        url += ":";
        url += "void(0)";
        links.attr("href", url);
        return links;
    };

    variableWidthSettings = function () {
        var i, ss, rulenr, stylesheet, rule;
        variableWidthSettings.updateMethods = [];

        var getWidthMinusFunction = function (rule, key, pixels_from_edge, unit) {
            return function () {
                rule.style[key] = (window.innerWidth - pixels_from_edge) + unit;
            };
        };

        var getHeightMinusFunction = function (rule, key, pixels_from_edge, unit) {
            return function () {
                rule.style[key] = (window.innerHeight - pixels_from_edge) + unit;
            };
        };


        for (ss = 0; ss < document.styleSheets.length; ss++) {
            stylesheet = document.styleSheets[ss];
            for (rulenr = 0; rulenr < stylesheet.cssRules.length; rulenr++) {
                rule = stylesheet.cssRules[rulenr];
                for (i in rule.style) { if (rule.style.hasOwnProperty(i)) {
                    var result = STYLEMAGIC_WIDTH_MINUS.exec(rule.style[i]);
                    if (result) {
                        variableWidthSettings.updateMethods.push(getWidthMinusFunction(rule, i, result[1], result[2]));
                    }
                    result = STYLEMAGIC_HEIGHT_MINUS.exec(rule.style[i]);
                    if (result) {
                        variableWidthSettings.updateMethods.push(getHeightMinusFunction(rule, i, result[1], result[2]));
                    }
                } }
            }
        }
        var update = function () {
            var i;
            for (i = 0; i < variableWidthSettings.updateMethods.length; i++) {
                variableWidthSettings.updateMethods[i]();
            }
        };
        window.onresize = update;
        update();
    };


    init();

    return {
        addDefaultLink: addDefaultLink,
        variableWidthSettings: variableWidthSettings,
        null: null
    };

};

var Util = UtilPrototype();

Util.variableWidthSettings();