/*jshint */
/*global exports, require*/

var root = this;
var _ = root._;
var clutils = root.clutils;

if (typeof exports !== "undefined") {
    /* node */
    if (!_) {_ = require("./underscore"); }
    clutils = exports;
} else {
    if (!_) {throw "Underscore not loaded"; }
    if (!clutils) {
        clutils = {};
    }
}

(function () {
    "use strict";
    var ID_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"; //make sure they are in ascending ascii order for sorting purposes

    /*Gets a unique ID, ascending with time*/
    clutils.getUniqueId = function () {
        var octalnow = (new Date()).valueOf().toString(8);
        var octalrandom = Math.floor(Math.random() * Math.pow(8, 6)).toString(8);
        while (octalnow.length < 14) { octalnow = "0" + octalnow; }
        while (octalrandom.length < 6) { octalrandom = "0" + octalrandom; }
        var octalid = octalnow + octalrandom;
        var id = _.map(octalid.match(/[0-7]{2}/g), function (octalindex) {
            var index = parseInt(octalindex, 8);
            return ID_CHARS.charAt(index);
        }).join("");
        return id;
    };

    clutils.formatTimeMs = function (timems) {
        var time_secondpart = Math.floor(timems / 1000) % 60;
        var time_minutepart = Math.floor(timems / 60000) % 60;
        var time_hourpart = Math.floor(timems / 3600000) % 60;
        var time_string = (time_hourpart > 0 ? time_hourpart + ":" + (time_minutepart < 10 ? "0" : "") : "") + time_minutepart + ":" + (time_secondpart < 10 ? "0" : "") + time_secondpart;
        return time_string;
    };

    clutils.encodeHTML = function (string) {
        //assumes a browser, not sure this will work in node (but easy to adapt in that case I guess...)
        var el = root.document.createElement("span");
        el.innerText = string;
        return el.innerHTML;
    };

    clutils.isUniqueIdOrZero = function (value) {
        return value === 0 || clutils.isUniqueId(value);
    };

    clutils.isUniqueId = function (value) {
        return !!/^[A-Za-z0-9_\-]{10}$/.exec(value);
    };

    /* using this in stead of date, because of stupid JSON not having Date object */
    clutils.nowts = function () {
        return new Date().valueOf();
    };

    //check whether it's a timestamp within some reasonable range. May not work with ancient dates...
    clutils.isTimestamp = function (value) {
        return !!/^[12][0-9]{12}$/.exec(value);
    };

    /*jshint eqeqeq: false */
    clutils.isNumeric = function (value) {
        //I'm sure that this is in no way definitive, but it works well enough for me....
        return value == parseFloat(value);
    };
    /*jshint eqeqeq: true */

    clutils.checkConstraints = function (object, constraints, path) {
        var mypath = path ? path : "toplevel";
        var cl_assert = function (assertion, message) {
            if (!assertion) {
                throw "At " + mypath + ": " + message;
            }
        };
        var cl_assertToObject = function (object, name) {
            return function (value, myobject) {
                cl_assert(
                    object["is" + name](myobject) === value,
                    "object " + JSON.stringify(myobject) + " should " + (value ? "" : "not ") + "be " + name.toLowerCase()
                );
            };
        };
        var checks = {
            "_is": function (value, myobject) {cl_assert(value === myobject, "object is not equal to " + JSON.stringify(value)); },
            "_isFunction": cl_assertToObject(_, "Function"),
            "_isDate": cl_assertToObject(_, "Date"),
            "_isNull": cl_assertToObject(_, "Null"),
            "_isNumber": cl_assertToObject(_, "Number"),
            "_isObject": cl_assertToObject(_, "Object"),
            "_isArray": cl_assertToObject(_, "Array"),
            "_isBoolean": cl_assertToObject(_, "Boolean"),
            "_isString": cl_assertToObject(_, "String"),
            "_matches": function (value, myobject) {cl_assert(value.exec(myobject), "object doesn't match " + value + ": " + JSON.stringify(myobject)); },
            "_isNumeric": cl_assertToObject(clutils, "Numeric"),
            "_isUniqueId": cl_assertToObject(clutils, "UniqueId"),
            "_isUniqueIdOrZero": cl_assertToObject(clutils, "UniqueIdOrZero"),
            "_isTimestamp": cl_assertToObject(clutils, "Timestamp"),
            "_optional": function () {},
        };
        cl_assert(_.isObject(constraints), "syntax error: constraints is not an object " + constraints);

        var strict = true;
        for (var constraint in constraints) {
            if (constraints.hasOwnProperty(constraint)) {
                if (constraint === "_strict" && !constraints[constraint]) {
                    strict = false;
                } else if (checks.hasOwnProperty(constraint)) {
                    checks[constraint](constraints[constraint], object);
                } else {
                    if (_.isObject(object) && constraint in object) {
                        clutils.checkConstraints(object[constraint], constraints[constraint], mypath + " -> " + constraint);
                    } else {
                        if (!constraints[constraint]._optional) {
                            cl_assert(false, "expected key \"" + constraint + "\" not in object");
                        }
                    }
                }

            }
        }

        if (strict && _.isObject(object)) {
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    if (! (key in constraints)) {
                        cl_assert(false, "object containts key " + key + ", which is not allowed in strict mode");
                    }
                }
            }
        }
    };

    clutils.pastDateText = function (date) {
        var timestamp = _.isDate(date) ? date.valueOf() : date;
        var nowts = clutils.nowts();
        var MINUTE = 60 * 1000;
        var HOUR = 60 * MINUTE;
        var DAY = 24 * HOUR;
        var MONTH = 30 * DAY;
        var diff = nowts - timestamp;
        if (diff < MINUTE) {
            return "just now";
        }
        if (diff < 0.75 * HOUR) {
            return Math.round(diff / MINUTE) + " minutes ago";
        }
        if (diff < 0.75 * DAY) {
            return Math.round(diff / HOUR) + " hours ago";
        }
        if (diff < MONTH) {
            return Math.round(diff / DAY) + " days ago";
        }
        return Math.floor(diff / MONTH) + " months ago"; //for some reason, for months it feels better to use floor
    };

    /**
     * Does something intelligent to toBoolean conversion.
     * Everything that evaluates to false, is false
     * in addition, strings "false", "off", "no" and "0" are false as well.
     * My jury is still out on empty array and object... So for now they are true
     **/
    clutils.toBoolean = function (value) {
        if (!value) {
            return false;
        }
        if (["0", "false", "off", "no"].indexOf(value) !== -1) {
            return false;
        }
        return true;
    };
})();

