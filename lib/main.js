var buttons = require('sdk/ui/button/action'),
    tabs = require("sdk/tabs");

var button = buttons.ActionButton({
  id: "mozilla-link",
  label: "Visit Mozilla",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

function handleClick(state) {
  tabs.open("https://www.mozilla.org/");
}

var self = require("sdk/self"),
    contextMenu = require("sdk/context-menu");

var menuItem = contextMenu.Item({
  label: "Quizlet: add to Set",
  context: contextMenu.SelectionContext(),
  contentScript: 'self.on("click", function () {' +
                 '  var text = window.getSelection().toString();' +
                 '  self.postMessage(text);' +
                 '});',
  image: self.data.url("icon-32.png"),
  onMessage: function (selectionText) {
    console.log(selectionText);
  }
});