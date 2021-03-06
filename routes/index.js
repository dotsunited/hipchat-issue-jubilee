var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// This is the heart of your HipChat Connect add-on. For more information,
// take a look at https://developer.atlassian.com/hipchat/tutorials/getting-started-with-atlassian-connect-express-node-js
module.exports = function(app, addon) {
    var hipchat = require('../lib/hipchat')(addon);

    // simple healthcheck
    app.get('/healthcheck', function(req, res) {
        res.send('OK');
    });

    // Root route. This route will serve the `addon.json` unless a homepage URL is
    // specified in `addon.json`.
    app.get('/',
        function(req, res) {
            // Use content-type negotiation to choose the best way to respond
            res.format({
                // If the request content-type is text-html, it will decide which to serve up
                'text/html': function() {
                    var homepage = url.parse(addon.descriptor.links.homepage);
                    if (homepage.hostname === req.hostname && homepage.path === req.path) {
                        res.render('homepage', addon.descriptor);
                    } else {
                        res.redirect(addon.descriptor.links.homepage);
                    }
                },
                // This logic is here to make sure that the `addon.json` is always
                // served up when requested by the host
                'application/json': function() {
                    res.redirect('/atlassian-connect.json');
                }
            });
        }
    );

    // This is an example route that's used by the default for the configuration page
    // https://developer.atlassian.com/hipchat/guide/configuration-page
    app.get('/config',
        // Authenticates the request using the JWT token in the request
        addon.authenticate(),
        function(req, res) {
            // The `addon.authenticate()` middleware populates the following:
            // * req.clientInfo: useful information about the add-on client such as the
            //   clientKey, oauth info, and HipChat account info
            // * req.context: contains the context data accompanying the request like
            //   the roomId
            var issue_numbers = config.issue_numbers;
            console.log(issue_numbers);
            res.render('config', issue_numbers);
        }
    );

    // This is an example route to handle an incoming webhook
    // https://developer.atlassian.com/hipchat/guide/webhooks
    app.post('/webhook',
        addon.authenticate(),
        function(req, res) {
            if (req.body.item.message.from === 'JIRA') {
                const command = req.body.item.message.message;
                const match_close = command.match(/Resolved/);
                const match = command.match(/https\:\/\/[a-zA-Z0-9]+\.atlassian\.net\/browse\/[a-zA-Z0-9]+\-[\d]+/);

                if (match_close != null) {
                    if (match_close.length > 0) {
                        if (match.length > 0) {
                          console.log(match);
                          console.log(match_close);
                            const numberArray = match[0].split("-");
                            if (numberArray.length > 1) {
                                for (let issue_number of config.issue_numbers) {
                                    if (numberArray[1] == issue_number) {
                                        let number = numberArray[1];

                                        if (number == 730){
                                          number = 1337;
                                        }

                                        const opt = {
                                            "format": "html",
                                            "notify": true
                                        }

                                        const fallback = `<img src="${config.localBaseUrl}/img/${number}.gif" align="middle" width="600" height="375"></img>`;

                                        hipchat.sendMessage(req.clientInfo, req.identity.roomId, fallback, opt).then(function(data) {
                                            console.log(data);
                                            res.sendStatus(200);
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    );

    // Notify the room that the add-on was installed. To learn more about
    // Connect's install flow, check out:
    // https://developer.atlassian.com/hipchat/guide/installation-flow
    addon.on('installed', function(clientKey, clientInfo, req) {
        hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
    });

    // Clean up clients when uninstalled
    addon.on('uninstalled', function(id) {
        addon.settings.client.keys(id + ':*', function(err, rep) {
            rep.forEach(function(k) {
                addon.logger.info('Removing key:', k);
                addon.settings.client.del(k);
            });
        });
    });

};
