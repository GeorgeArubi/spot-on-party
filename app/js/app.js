/*jshint browser: true*/
/*global clutils, _, $, Backbone */

if (!window.PM) {
    window.PM = {};
}

(function (PM) {
    "use strict";
    var LoginView, PartyOverviewView;

    var getTemplate = function (id) {
        var template = PM.templates[id];
        if (!_.isFunction(template)) {
            throw "Template '" + id + "' not found";
        }
        return template;
    };

    var createAndRenderView = function (Viewclass, element, options) {
        var myoptions = _.extend(options || {}, {el: element});
        var view = new Viewclass(myoptions);
        view.render();
        var el = $(element);
        el.addClass(view.className);
        el.attr("view", view);
        el.trigger("pagecreate");
    };

    PartyOverviewView = Backbone.View.extend({
        template: getTemplate('party-overview-page'),
        className: 'party-overview-page',

    });

    LoginView = Backbone.View.extend({
        template: getTemplate('login-page'),

        events: {
            "click .fb-login-button": "facebookLogin",
        },

        className: 'login-page',

        render: function () {
            var that = this;
            that.$el.html(that.template({party_id: that.options.party_id}));
            return that;
        },

        facebookLogin: function () {
            window.location = "https://m.facebook.com/dialog/oauth?redirect_uri=" + encodeURIComponent(window.location.toString()) + "&client_id=" + encodeURIComponent(PM.domain.FacebookDomain.FACEBOOK_APP_ID) + "&response_type=token";
        },
    });

    var router = new $.mobile.Router({
        "^#login(?:\\?(.*))?$": {
            events: "bs",
            handler: function (type, match, ui, page) {
                var params = (match[1] && match[1].length) ? router.getParams(match[1]) : {};
                PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                    if (loggedin) {
                        if (params.party_id) {
                            $.mobile.changePage("#party/" + params.party_id);
                        } else {
                            $.mobile.changePage("#partyoverview");
                        }
                    } else {
                        createAndRenderView(LoginView, page, {party_id: params.party_id});
                    }
                });
            },
        },
        "^#partyoverview": {
            events: "bs",
            handler: function (type, match, ui, page) {
                PM.domain.FacebookDomain.isLoggedin(function (loggedin) {
                    if (loggedin) {
                        createAndRenderView(PartyOverviewView, page, {party_id: params.party_id});
                    } else {
                        $.mobile.changePage("#login");
                    }
                });

            },
        },
        ".": {
            events: "h",
            handler: function (type, match, ui, page) {
                console.log("killing", $(page).attr("view"));
            },
        },
        "^#([^?]*)": {
            events: "bC",
            handler: function (undefined, match) {
                console.log("seeing " + match[1]);
                var page_id = match[1];
                if (!document.getElementById(page_id)) {
                    var page = $("<div>");
                    page.attr({
                        id: page_id,
                        "data-role": "page",
                    });
                    page.text(page_id);
                    $('body').append(page);
                }
            }
        },
    });

    PM.domain.FacebookDomain = PM.domain.FacebookWebDomain;
    PM.domain.FacebookDomain.init();

})(window.PM);
