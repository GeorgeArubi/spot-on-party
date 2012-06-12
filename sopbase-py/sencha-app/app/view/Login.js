/*jslint browser: true*/
/*globals Ext, SOP, FB*/
"use strict";

/**
 * This view shows the 'Initializing' loading mask, as well as displaying the Login text and button
 * if the user isn't logged in to Facebook.
 */
Ext.define('SOP.view.Login', {
    extend: 'Ext.Container',

    config: {
        padding: 20,
        layout: 'fit',

        items: [
            {
                docked: 'top',
                xtype: 'toolbar',
                html: 'jogToolbar'
            }
        ]
    },

    showLoginText: function () {

        var redirectUrl = Ext.Object.toQueryString({
            redirect_uri: window.location.protocol + "//" + window.location.host + window.location.pathname,
            client_id: SOP.app.facebookAppId,
            response_type: 'token'
        });

        this.setHtml([
            '<h2>Spot On Party</h2>',
            '<p>Spot On Party allows you to colaboratively control a party playlist</p>',
            '<a class="fbLogin" href="https://m.facebook.com/dialog/oauth?' + redirectUrl + '"></a>',
            '<div class="fb-facepile" data-app-id="' + SOP.app.facebookAppId + '" data-max-rows="2" data-width="300"></div>'
        ].join(''));

        FB.XFBML.parse(document.getElementById('splash'));
    }
});
