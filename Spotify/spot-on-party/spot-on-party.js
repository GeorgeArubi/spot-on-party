/*jslint browser: true, devel: true, vars: true, newcap: true */
/*global SpotOnParty:true, SOPBase, Facebook, $, TDFriendSelector */

/**
 * Main interaction for SpotOnParty
 **/
"use strict";

var SpotOnParty = function () {
    var init;
    var activatePane;
    var selectFacebookFriends;
    var createStartPartyBehaviour;
    var resetNewPartyForm;
    var initFacebookFriendpicker;

    var onfacebooklogin;
    var onfacebooklogout;

    var facebook;
    var sopbase;

    var config = {
        minLengthPartyName: 6
    };

    activatePane = function (pane) {
        $(".activepane").removeClass("activepane");
        $(pane).addClass("activepane");
    };

    onfacebooklogin = function () {
        activatePane("#start_party_pane");
        resetNewPartyForm();
        initFacebookFriendpicker();
        sopbase = SOPBase(facebook.getAccessToken());
    };

    onfacebooklogout = function () {
        activatePane("#login_pane");
    };

    initFacebookFriendpicker = function () {
        selectFacebookFriends.inited = false;
        TDFriendSelector.init({debug: false});
        $.getJSON('https://graph.facebook.com/me/friends&access_token=' + window.encodeURIComponent(facebook.getAccessToken()) + '&callback=?', function (result) {
            TDFriendSelector.setFriends(result.data);
            selectFacebookFriends.inited = true;
        });
    };

    createStartPartyBehaviour = function () {
        $("#start_party_button").click(function (event) {
            $("#start_party_name_form").addClass("active");
            $("#start_party_name")[0].focus();
            event.preventDefault();
        });
        $("#start_party_name_form").submit(function (event) {
            var name = $("#start_party_name").val();
            if (name.length < config.minLengthPartyName) {
                $("#start_party_name_error_length").removeClass("active");
                window.setTimeout(function () {
                    $("#start_party_name_error_length").addClass("active");
                }, 1);
            } else {
                selectFacebookFriends(function (facebook_ids) {
                    sopbase.createParty(name, facebook_ids, function (response) {
                        console.log(response);
                    });
                });
            }
            event.preventDefault();
        });
    };

    resetNewPartyForm = function () {
        $("#start_party_pane .active").removeClass("active");
        $("#start_party_pane .input").val("");
    };

    selectFacebookFriends = function (callback) {
        if (!selectFacebookFriends.inited) {
            window.setTimeout(function () {selectFacebookFriends(callback); }, 100); // try again in 100ms
        } else {
            var selector = TDFriendSelector.newInstance({
                maxSelection: 100,
                callbackSubmit: callback
            });
            selector.showFriendSelector();
        }

    };

    init = function () {
        createStartPartyBehaviour();
        $("#facebook_login_button").click(function (event) {
            facebook = Facebook(onfacebooklogin, onfacebooklogout);
        });
    };

    init();

    return {};
};