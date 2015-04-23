//Quizlet Helper - v0.1

// Import the APIs we need.
var cm = require("sdk/context-menu");
var notifications = require("sdk/notifications");
var self = require('sdk/self');
var tabs = require("sdk/tabs");
var ui = require("sdk/ui");
var pageMod = require("sdk/page-mod");
var ss = require("sdk/simple-storage");
var request = require("sdk/request");
var timers = require("sdk/timers");
var frame = require("sdk/frame/hidden-frame");
var prefs = require("sdk/simple-prefs").prefs;
var widget;

var oauth = {
	getToken: function(){
		return ss.storage.access_token;
	},
	login: function(options, callback){
		/* options should have scopes,client id, client secret, callback*/
		var csrf = new Date().getTime();
		var url="https://quizlet.com/authorize?client_id="+options.client_id+"&response_type=code&scope="+ encodeURIComponent(options.scopes) +"&state=ff7516fb3e3b94e5c73fbd06295f5489&redirect_uri="+ encodeURIComponent(options.redirect_url);
		tabs.open(url);
		pageMod.PageMod({
			include: self.data.url("login.html"),
			contentScriptFile: self.data.url("login.js"),
			onMessage: function(code){
						request.Request({
							url: "https://api.quizlet.com/oauth/token",
							headers: {
								'Authorization': 'Basic NjZwR056cnVzZzpGUHVkS1Nmc1hTNG5DVkhNTlZQZnFH'
							},
							content: {
								code: code,
								client_id: options.client_id,
								client_secret: options.client_secret,
								grant_type: "authorization_code",
								redirect_uri: options.redirect_url
							},
							onComplete: function(response){
								console.log("get access token:", response);
								if (response.json.error) {
									showInfoBox("[ERROR]: '" + response.json.error_description + "'");
								} else {
									ss.storage.access_token = response.json.access_token;
									ss.storage.refresh_token = response.json.refresh_token;
									ss.storage.user_id = response.json.user_id;
									showInfoBox("You are logged successfully!");
									setSetId(); //choose the Set for addeding new Terms
									//callback(ss.storage.access_token);
								}
							}
						}).post();
			}
		});
		tabs.open(self.data.url("login.html"));
	},
	refreshToken: function(options, callback){
		if(ss.storage.refresh_token == undefined) {
			this.login(options, callback);
		} else {
			request.Request({
				url: "https://www.googleapis.com/oauth2/v3/token",
				content: {
					refresh_token: ss.storage.refresh_token,
					client_id: options.client_id,
					client_secret: options.client_secret,
					grant_type: "refresh_token"
				},
				onComplete: function(response){
					ss.storage.access_token=response.json.access_token;
					callback(ss.storage.access_token);
				}
			}).post();
		}
	},
}

var oauth_options = {
	client_id: "66pGNzrusg",
	client_secret: "FPudKSfsXS4nCVHMNVPfqG",
	scopes: "read write_set",
	redirect_url: "https://github.com/DarkFisk/Quizlet-Helper",
	callback: updateWidget
};

function drawWidget(earnings) {
	frame.add(frame.HiddenFrame({
		onReady: function() {
			var canvas = this.element.contentDocument.createElement("canvas");
			canvas.width=128;
			canvas.height=128;
			var img= this.element.contentDocument.createElement("img");
			img.src=self.data.url("icon-32.png");
			var ctx=canvas.getContext("2d");
			ctx.drawImage(img,0,0);
			ctx.font="60px serif";
			ctx.fillText(""+earnings,0,64);
			
			widget.icon=canvas.toDataURL("image/png");
		}
	}));
}

function formatTime(date) {
	return date.toISOString().substring(0, 10);
}

function showInfoBox(msg) {
	notifications.notify({
	    title: "Quizful",
	    iconURL: self.data.url("icon-32.png"),
	    text: msg,
	    data: "did gyre and gimble in the wabe",
	    onClick: function (data) {
	      console.log(data);
	      // console.log(this.data) would produce the same result.
	  }
	});
}

function updateWidget(token) {
	var today=new Date();
	var yesterday=new Date();
	request.Request({
		url: "https://www.googleapis.com/adsense/v1.4/reports",
		content: {
			access_token: token,
			endDate: formatTime(today),
			startDate: formatTime(yesterday),
			metric: "EARNINGS"
		},
		onComplete: function(response){
			if(response.json.error)
			{
				oauth.refreshToken(oauth_options, updateWidget);
			}else{
				var earnings=0;
				for(var i=0;i<response.json.totals.length;i++)
				{
					earnings+=parseFloat(response.json.totals[i]);
				}
				drawWidget(earnings);
			}
		}
	}).get();
}


function setSetId() {
	var defaultSetName = 'from-firefox-helper',
		token = oauth.getToken(),
		user_id = ss.storage.user_id;
	
	if (!token) {
		showInfoBox("[ERROR]: Please, login in Quizlet first!");
	} else {
		//get Sets list
		request.Request({
			url: "https://api.quizlet.com/2.0/users/" + user_id + "/sets",
			headers: {
				'Authorization': 'Bearer ' + token
			},
			content: {
				whitespace: true
			},
			onComplete: function(response){
				console.log('Get user sets:', response);
				var result = response.json,
					setId = 0;
				
				if(result.error) {
					showInfoBox("[ERROR]: '" + result.error_description + "'");
				} else {
					// check if default Set is already created
					for (var i = 0, len = result.length; i < len; i++) {
						var set = result[i];
						if (set.title == defaultSetName) {
							setId = set.id;
							break;
						} 
					}
					console.log('setId:', setId);
					
					//create new default Set
					if (setId) {
						prefs.quizletSetId = setId.toString();
					} else {
						request.Request({
							url: "https://api.quizlet.com/2.0/sets",
							headers: {
								'Authorization': 'Bearer ' + token
							},
							content: "terms%5B%5D=first&terms%5B%5D=second&definitions%5B%5D=test1&definitions%5B%5D=test2&allow_discussion=true&lang_terms=en&lang_definitions=en&title="+defaultSetName+"&whitespace=true",
							onComplete: function(response){
								console.log("add new Set:", response);
								if (response.json.error) {
									showInfoBox("[ERROR]: '" + response.json.error_description + "'");
								} else {
									prefs.quizletSetId = response.json.id;
									showInfoBox("Created default Set '" + defaultSetName + "' successfully");
								}
							}
						}).post();
					}
				}
			}
		}).get();
	}
}

exports.main=function(options){
	if(options.loadReason=="install")
	{
		tabs.open(oauth_options.redirect_url);
	}
	
	widget=ui.ActionButton({
		id: "quizlet-helper",
		label: "Quizful Helper",
		icon: self.data.url("icon-32.png"), //TODO, CANVAS GENERATED PNG
		onClick: function(state){
			var token = oauth.getToken();
			if (token) {
				console.log("ActionButton onClick: token=" + token);
			} else {
				console.log("ActionButton onClick: opened OAuth form");
				updateWidget(token);
			}
		}
	});
	
	var menuItemAddTerm = cm.Item({
        label: "Quizlet: Add to Set",
        image: self.data.url("icon-32.png"),
        // Show this item when a selection exists.
        context: cm.SelectionContext(),
        // When this item is clicked, post a message to the item with the text
        contentScript: 'self.on("click", function () {' +
                       '  self.postMessage(window.getSelection().toString());' +
                       '});',
        //add selected Term to the Quizlet Set
        onMessage: function(text) {
        	var token = oauth.getToken();
        	var setId = prefs.quizletSetId;
        	console.log("setId", setId);
        	
        	if (!setId) {
        		showInfoBox("[ERROR]: Please, provide Quizlet default Set Id!");
        	} else if (token) {
        		request.Request({
    				url: "https://api.quizlet.com/2.0/sets/" + setId + "/terms",
    				headers: {
    					'Authorization': 'Bearer ' + token
    				},
    				content: {
    					term: text,
    					definition: 'undefined'
    				},
    				onComplete: function(response){
    					console.log(response);
    					if (response.json.error) {
    						showInfoBox("[ERROR]: '" + response.json.error_description + "'");
    					} else {
    						showInfoBox("new term '" + response.json.term + "' added successfully");
    					}
    				}
    			}).post();
        	} else {
        		showInfoBox("[ERROR]: Please, login in Quizlet first!");
        	}
        }
    });
	
	oauth.refreshToken(oauth_options, updateWidget);
	
//	timers.setInterval(function(){
//		updateWidget(oauth.getToken());
//	},1000*60*2 /* Every 2 minute */);
}
