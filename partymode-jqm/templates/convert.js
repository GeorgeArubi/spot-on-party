#!/usr/local/bin/node
/*jshint node:true, browser:false*/

(function () {
    "use strict";
    var fs = require('fs');
    var _ = require('../js/underscore');

    var output = "PM = window.PM || {};\nPM.templates = PM.templates || {};\n";

    var files = fs.readdirSync(__dirname);
    files.forEach(function (file) {
        if (file.slice(-5) === ".mtpl") {
            var fullname = __dirname + "/" + file;
            var content = fs.readFileSync(fullname, "utf-8");
            var template_f = _.template(content).source;
            var variable_name = "PM.templates[" + JSON.stringify(file.slice(0, -5)) + "]";
            output += variable_name + "=" + template_f + ";\n";
        }
    });

    fs.writeFileSync(__dirname + "/templates.js", output);
})();
